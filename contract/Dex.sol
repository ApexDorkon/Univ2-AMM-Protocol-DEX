// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////
                            LIBRARIES & INTERFACES
//////////////////////////////////////////////////////////////*/

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library TransferHelper {
    function safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }
    function safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "APPROVE_FAILED");
    }
}

library Math {
    function min(uint256 x, uint256 y) internal pure returns (uint256) { return x < y ? x : y; }
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) { z = 1; }
    }
}

/*//////////////////////////////////////////////////////////////
                            FACTORY
//////////////////////////////////////////////////////////////*/

interface IDexPair { function initialize(address, address) external; }

contract DexFactory {
    address public feeTo;
    address public feeToSetter;
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _feeToSetter) { feeToSetter = _feeToSetter; }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPair[token0][token1] == address(0), "PAIR_EXISTS");
        bytes memory bytecode = type(DexPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly { pair := create2(0, add(bytecode, 32), mload(bytecode), salt) }
        IDexPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint) { return allPairs.length; }
    function setFeeTo(address _feeTo) external { require(msg.sender == feeToSetter, "FORBIDDEN"); feeTo = _feeTo; }
    function setFeeToSetter(address _feeToSetter) external { require(msg.sender == feeToSetter, "FORBIDDEN"); feeToSetter = _feeToSetter; }
}

/*//////////////////////////////////////////////////////////////
                             PAIR
//////////////////////////////////////////////////////////////*/

contract DexPair {
    using Math for uint256;
    using TransferHelper for address;

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public factory;
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 private constant MINIMUM_LIQUIDITY = 1e3;
    uint256 private unlocked = 1;
    modifier lock() { require(unlocked == 1, "LOCKED"); unlocked = 0; _; unlocked = 1; }

    uint24 public swapFee = 30; 
    uint24 public protocolFeeRatio = 1666; 

    uint256 public accFeePerShare0;
    uint256 public accFeePerShare1;
    mapping(address => uint256) public userFeeDebt0;
    mapping(address => uint256) public userFeeDebt1;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    event Mint(address sender, uint amount0, uint amount1);
    event Burn(address sender, uint amount0, uint amount1, address to);
    event Swap(address sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address to);
    event Sync(uint112 reserve0, uint112 reserve1);
    event FeesDistributed(uint fee0, uint fee1);
    event FeesClaimed(address indexed user, uint amount0, uint amount1);

    constructor() { factory = msg.sender; }

    function approve(address spender, uint value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external returns (bool) { return transferFrom(msg.sender, to, value); }

    function transferFrom(address from, address to, uint value) public returns (bool) {
        uint allowed = allowance[from][msg.sender];
        if (from != msg.sender && allowed != type(uint).max) {
            require(allowed >= value, "ALLOWANCE_LOW");
            allowance[from][msg.sender] = allowed - value;
        }
        require(balanceOf[from] >= value, "BALANCE_LOW");
        _updateRewards(from);
        _updateRewards(to);
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "FORBIDDEN");
        token0 = _token0;
        token1 = _token1;
        string memory sym0 = _getSymbol(_token0);
        string memory sym1 = _getSymbol(_token1);
        name = string(abi.encodePacked("LP: ", sym0, "-", sym1));
        string memory lpSymbol = string(abi.encodePacked(sym0, "-", sym1));
        bytes memory symbolBytes = bytes(lpSymbol);
        if (symbolBytes.length > 11) {
            bytes memory shortSymbol = new bytes(11);
            for (uint i = 0; i < 11; i++) { shortSymbol[i] = symbolBytes[i]; }
            lpSymbol = string(shortSymbol);
        }
        symbol = lpSymbol;
    }

    function _getSymbol(address token) internal view returns (string memory) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("symbol()"));
        return (success && data.length >= 32) ? abi.decode(data, (string)) : "UNK";
    }

    function getReserves() public view returns (uint112, uint112, uint32) { return (reserve0, reserve1, blockTimestampLast); }

    function _update(uint balance0, uint balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    function mint(address to) external lock returns (uint liquidity) {
        (uint112 _r0, uint112 _r1,) = getReserves();
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0 = balance0 - _r0;
        uint amount1 = balance1 - _r1;
        if (totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            balanceOf[address(0)] += MINIMUM_LIQUIDITY;
        } else {
            liquidity = Math.min(amount0 * totalSupply / _r0, amount1 * totalSupply / _r1);
        }
        _updateRewards(to);
        balanceOf[to] += liquidity;
        totalSupply += liquidity;
        emit Transfer(address(0), to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external lock returns (uint amount0, uint amount1) {
        uint liquidity = balanceOf[address(this)];
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        _updateRewards(address(this));
        _updateRewards(to);
        uint _totalSupply = totalSupply;
        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");
        balanceOf[address(this)] -= liquidity;
        totalSupply -= liquidity;
        emit Transfer(address(this), address(0), liquidity);
        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata) external lock {
        require(amount0Out > 0 || amount1Out > 0, "INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _r0, uint112 _r1,) = getReserves();
        require(amount0Out < _r0 && amount1Out < _r1, "INSUFFICIENT_LIQUIDITY");
        if (amount0Out > 0) token0.safeTransfer(to, amount0Out);
        if (amount1Out > 0) token1.safeTransfer(to, amount1Out);
        uint bal0 = IERC20(token0).balanceOf(address(this));
        uint bal1 = IERC20(token1).balanceOf(address(this));
        uint a0In; uint a1In;
        unchecked {
            a0In = bal0 > (_r0 - amount0Out) ? bal0 - (_r0 - amount0Out) : 0;
            a1In = bal1 > (_r1 - amount1Out) ? bal1 - (_r1 - amount1Out) : 0;
        }
        require(a0In > 0 || a1In > 0, "INSUFFICIENT_INPUT_AMOUNT");
        uint fee0 = (a0In * swapFee) / 10000;
        uint fee1 = (a1In * swapFee) / 10000;
        _distributeFees(fee0, fee1);
        uint adj0 = a0In - fee0;
        uint adj1 = a1In - fee1;
        unchecked {
            uint b0Adj = (bal0 * 1000) - (adj0 * 3);
            uint b1Adj = (bal1 * 1000) - (adj1 * 3);
            require(b0Adj * b1Adj >= uint(_r0) * uint(_r1) * 1_000_000, "K");
        }
        _update(bal0, bal1);
        emit Swap(msg.sender, a0In, a1In, amount0Out, amount1Out, to);
    }

    function _distributeFees(uint fee0, uint fee1) internal {
        address feeTo = DexFactory(factory).feeTo();
        uint protocolCut0 = (fee0 * protocolFeeRatio) / 10000;
        uint protocolCut1 = (fee1 * protocolFeeRatio) / 10000;
        if (feeTo != address(0)) {
            if (protocolCut0 > 0) token0.safeTransfer(feeTo, protocolCut0);
            if (protocolCut1 > 0) token1.safeTransfer(feeTo, protocolCut1);
        }
        uint lpFee0 = fee0 - protocolCut0;
        uint lpFee1 = fee1 - protocolCut1;
        if (lpFee0 > 0 && totalSupply > 0) accFeePerShare0 += (lpFee0 * 1e12) / totalSupply;
        if (lpFee1 > 0 && totalSupply > 0) accFeePerShare1 += (lpFee1 * 1e12) / totalSupply;
        emit FeesDistributed(lpFee0, lpFee1);
    }

    function pendingFees(address user) public view returns (uint pending0, uint pending1) {
        pending0 = (balanceOf[user] * accFeePerShare0) / 1e12 - userFeeDebt0[user];
        pending1 = (balanceOf[user] * accFeePerShare1) / 1e12 - userFeeDebt1[user];
    }

    function _updateRewards(address user) internal {
        if (user == address(0)) return;
        (uint p0, uint p1) = pendingFees(user);
        if (p0 > 0) token0.safeTransfer(user, p0);
        if (p1 > 0) token1.safeTransfer(user, p1);
        userFeeDebt0[user] = (balanceOf[user] * accFeePerShare0) / 1e12;
        userFeeDebt1[user] = (balanceOf[user] * accFeePerShare1) / 1e12;
    }

    function claimFees() external { _updateRewards(msg.sender); emit FeesClaimed(msg.sender, 0, 0); }

    function setSwapFee(uint24 newFee) external {
        require(msg.sender == DexFactory(factory).feeToSetter(), "NOT_AUTH");
        require(newFee <= 100, "FEE_TOO_HIGH");
        swapFee = newFee;
    }
}

/*//////////////////////////////////////////////////////////////
                            ROUTER
//////////////////////////////////////////////////////////////*/

contract DexRouter {
    using TransferHelper for address;
    address public immutable factory;
    address public immutable wrappedMOCA;

    constructor(address _factory, address _wrappedMOCA) { factory = _factory; wrappedMOCA = _wrappedMOCA; }
    receive() external payable {}

    function pairFor(address tokenA, address tokenB) public view returns (address pair) {
        pair = DexFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_NOT_EXIST");
    }

    function addLiquidityMOCA(address token, uint amountTokenDesired, address to) external payable returns (uint amountMOCA, uint amountToken, uint liquidity) {
        address pair = DexFactory(factory).getPair(wrappedMOCA, token);
        if (pair == address(0)) pair = DexFactory(factory).createPair(wrappedMOCA, token);
        (bool ok,) = wrappedMOCA.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(ok, "WRAP_FAILED");
        wrappedMOCA.safeTransfer(pair, msg.value);
        token.safeTransferFrom(msg.sender, pair, amountTokenDesired);
        liquidity = DexPair(pair).mint(to);
        (amountMOCA, amountToken) = (msg.value, amountTokenDesired);
    }

    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, address to) external returns (uint amountA, uint amountB, uint liquidity) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        address pair = DexFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) pair = DexFactory(factory).createPair(tokenA, tokenB);
        (address token0,) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (uint a0, uint a1) = tokenA == token0 ? (amountADesired, amountBDesired) : (amountBDesired, amountADesired);
        tokenA.safeTransferFrom(msg.sender, pair, a0);
        tokenB.safeTransferFrom(msg.sender, pair, a1);
        liquidity = DexPair(pair).mint(to);
        (amountA, amountB) = (amountADesired, amountBDesired);
    }

    function removeLiquidityMOCA(address token, uint liquidity, address to) external returns (uint amountMOCA, uint amountToken) {
        address pair = pairFor(wrappedMOCA, token);
        TransferHelper.safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint a0, uint a1) = DexPair(pair).burn(address(this));
        (address t0,) = wrappedMOCA < token ? (wrappedMOCA, token) : (token, wrappedMOCA);
        (amountMOCA, amountToken) = wrappedMOCA == t0 ? (a0, a1) : (a1, a0);
        (bool success,) = wrappedMOCA.call(abi.encodeWithSignature("withdraw(uint256)", amountMOCA));
        require(success, "UNWRAP_FAILED");
        (bool sent,) = payable(to).call{value: amountMOCA}("");
        require(sent, "SEND_FAILED");
        token.safeTransfer(to, amountToken);
    }

    function getReserves(address tokenA, address tokenB) public view returns (uint rA, uint rB) {
        address pair = DexFactory(factory).getPair(tokenA, tokenB);
        (uint112 r0, uint112 r1,) = DexPair(pair).getReserves();
        (address t0,) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (rA, rB) = tokenA == t0 ? (r0, r1) : (r1, r0);
    }

    function getAmountOut(uint amountIn, uint rIn, uint rOut) public pure returns (uint amountOut) {
        require(amountIn > 0 && rIn > 0 && rOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = amountIn * 997;
        amountOut = (amountInWithFee * rOut) / (rIn * 1000 + amountInWithFee);
    }

    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address tokenIn, address tokenOut, address to) external {
        (uint rIn, uint rOut) = getReserves(tokenIn, tokenOut);
        uint amountOut = getAmountOut(amountIn, rIn, rOut);
        require(amountOut >= amountOutMin, "SLIPPAGE_TOO_HIGH");
        address pair = DexFactory(factory).getPair(tokenIn, tokenOut);
        tokenIn.safeTransferFrom(msg.sender, pair, amountIn);
        (address t0,) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        (uint a0Out, uint a1Out) = tokenIn == t0 ? (uint(0), amountOut) : (amountOut, uint(0));
        DexPair(pair).swap(a0Out, a1Out, to, new bytes(0));
    }

    function swapExactMOCAForTokens(uint amountOutMin, address tokenOut, address to) external payable {
        (bool ok,) = wrappedMOCA.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(ok, "WRAP_FAILED");
        address pair = pairFor(wrappedMOCA, tokenOut);
        (uint rIn, uint rOut) = getReserves(wrappedMOCA, tokenOut);
        uint amountOut = getAmountOut(msg.value, rIn, rOut);
        require(amountOut >= amountOutMin, "SLIPPAGE_TOO_HIGH");
        wrappedMOCA.safeTransfer(pair, msg.value);
        (address t0,) = wrappedMOCA < tokenOut ? (wrappedMOCA, tokenOut) : (tokenOut, wrappedMOCA);
        (uint a0Out, uint a1Out) = wrappedMOCA == t0 ? (uint(0), amountOut) : (amountOut, uint(0));
        DexPair(pair).swap(a0Out, a1Out, to, new bytes(0));
    }

    function swapExactTokensForMOCA(uint amountIn, uint amountOutMin, address tokenIn, address to) external {
        address pair = pairFor(tokenIn, wrappedMOCA);
        (uint rIn, uint rOut) = getReserves(tokenIn, wrappedMOCA);
        uint amountOut = getAmountOut(amountIn, rIn, rOut);
        require(amountOut >= amountOutMin, "SLIPPAGE_TOO_HIGH");
        tokenIn.safeTransferFrom(msg.sender, pair, amountIn);
        (address t0,) = tokenIn < wrappedMOCA ? (tokenIn, wrappedMOCA) : (wrappedMOCA, tokenIn);
        (uint a0Out, uint a1Out) = tokenIn == t0 ? (uint(0), amountOut) : (amountOut, uint(0));
        DexPair(pair).swap(a0Out, a1Out, address(this), new bytes(0));
        (bool ok,) = wrappedMOCA.call(abi.encodeWithSignature("withdraw(uint256)", amountOut));
        require(ok, "UNWRAP_FAILED");
        (bool sent,) = payable(to).call{value: amountOut}("");
        require(sent, "SEND_FAILED");
    }
}

/*//////////////////////////////////////////////////////////////
                            WMOCA
//////////////////////////////////////////////////////////////*/

contract WMOCA {
    string public name = "Wrapped MOCA";
    string public symbol = "WMOCA";
    uint8 public decimals = 18;
    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;
    receive() external payable { deposit(); }
    function deposit() public payable { balanceOf[msg.sender] += msg.value; emit Deposit(msg.sender, msg.value); }
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad, "INSUFFICIENT");
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }
    function approve(address guy, uint wad) public returns (bool) { allowance[msg.sender][guy] = wad; emit Approval(msg.sender, guy, wad); return true; }
    function transfer(address dst, uint wad) public returns (bool) { return transferFrom(msg.sender, dst, wad); }
    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        require(balanceOf[src] >= wad, "BALANCE_LOW");
        if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
            require(allowance[src][msg.sender] >= wad, "ALLOWANCE_LOW");
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}

/*//////////////////////////////////////////////////////////////
                            TEST TOKEN
//////////////////////////////////////////////////////////////*/

contract TestERC20 {
    string public name; string public symbol; uint8 public constant decimals = 18; uint256 public totalSupply;
    mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name; symbol = _symbol; _mint(msg.sender, _initialSupply);
    }
    function _mint(address to, uint256 value) internal { balanceOf[to] += value; totalSupply += value; emit Transfer(address(0), to, value); }
    function transfer(address to, uint256 value) external returns (bool) { balanceOf[msg.sender] -= value; balanceOf[to] += value; emit Transfer(msg.sender, to, value); return true; }
    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true; }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        balanceOf[from] -= value; balanceOf[to] += value; emit Transfer(from, to, value); return true;
    }
    function mint(address to, uint256 value) external { _mint(to, value); }
}