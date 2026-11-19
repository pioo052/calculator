/*
 * parser.js
 * A small, safe mathematical expression parser and evaluator.
 *
 * The calculator never uses eval() or new Function(). Typed input is
 * tokenised, parsed into an abstract syntax tree with a recursive descent
 * parser, and then evaluated node by node. That gives us correct operator
 * precedence, right-associative powers, implicit multiplication (2π, 3(4+1))
 * and full control over error messages.
 *
 * Grammar (highest precedence first):
 *   expression    -> additive
 *   additive      -> multiplicative (('+' | '-') multiplicative)*
 *   multiplicative-> unary (('*' | '/' | implicit) unary)*
 *   unary         -> ('+' | '-') unary | power
 *   power         -> postfix ('^' unary)?          (right associative)
 *   postfix       -> primary ('!' | '%')*
 *   primary       -> number | constant | function '(' expression ')'
 *                  | function unary | '(' expression ')'
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Errors                                                             */
  /* ------------------------------------------------------------------ */

  class CalcError extends Error {
    constructor(message) {
      super(message);
      this.name = 'CalcError';
    }
  }

  const FUNCTIONS = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'abs'
  ]);

  const MAX_FACTORIAL = 170; // 171! is Infinity in double precision
  const TRIG_SNAP = 1e-12;   // values this close to an integer are snapped

  const NUMBER_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
  const NAME_RE = /^[a-zA-Z]+/;

  /* ------------------------------------------------------------------ */
  /* Tokenizer                                                          */
  /* ------------------------------------------------------------------ */

  // Normalise the pretty display symbols the interface uses into plain
  // calculator tokens the grammar understands.
  function normalize(source) {
    return String(source)
      .replace(/[×·]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/√/g, 'sqrt')
      .replace(/π/g, 'pi');
  }

  function tokenize(source) {
    const input = normalize(source);
    const tokens = [];
    let index = 0;

    while (index < input.length) {
      const char = input[index];

      if (char === ' ' || char === '\t' || char === '\n') {
        index += 1;
        continue;
      }

      // Numbers, including a leading decimal point and exponent notation.
      if (/[0-9.]/.test(char)) {
        const match = NUMBER_RE.exec(input.slice(index));
        if (!match) {
          throw new CalcError('Invalid number in expression');
        }
        tokens.push({ type: 'number', value: parseFloat(match[0]) });
        index += match[0].length;
        continue;
      }

      // Constants and function names.
      if (/[a-zA-Z]/.test(char)) {
        const match = NAME_RE.exec(input.slice(index));
        const name = match[0].toLowerCase();
        index += match[0].length;

        if (name === 'pi') {
          tokens.push({ type: 'constant', name: 'pi', value: Math.PI });
        } else if (name === 'e') {
          tokens.push({ type: 'constant', name: 'e', value: Math.E });
        } else if (FUNCTIONS.has(name)) {
          tokens.push({ type: 'function', name: name });
        } else {
          throw new CalcError('Unknown function "' + name + '"');
        }
        continue;
      }

      if ('+-*/^()!%'.indexOf(char) !== -1) {
        tokens.push({ type: 'operator', value: char });
        index += 1;
        continue;
      }

      throw new CalcError('Unexpected character "' + char + '"');
    }

    return tokens;
  }

  /* ------------------------------------------------------------------ */
  /* Parser (tokens -> AST)                                             */
  /* ------------------------------------------------------------------ */

  function startsPrimary(token) {
    if (!token) return false;
    if (token.type === 'number' || token.type === 'constant' || token.type === 'function') {
      return true;
    }
    return token.type === 'operator' && token.value === '(';
  }

  function parse(tokens) {
    let position = 0;

    const peek = function () { return tokens[position]; };
    const next = function () { return tokens[position++]; };
    const isOperator = function (value) {
      const token = peek();
      return Boolean(token) && token.type === 'operator' && token.value === value;
    };

    function parseExpression() {
      return parseAdditive();
    }

    function parseAdditive() {
      let node = parseMultiplicative();
      while (peek() && peek().type === 'operator' &&
             (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        node = { type: 'binary', op: op, left: node, right: parseMultiplicative() };
      }
      return node;
    }

    function parseMultiplicative() {
      let node = parseUnary();
      for (;;) {
        const token = peek();
        if (!token) break;

        if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
          next();
          node = { type: 'binary', op: token.value, left: node, right: parseUnary() };
        } else if (startsPrimary(token)) {
          // Implicit multiplication: 2π, 3(4+1), 2sin(30), (2)(3).
          node = { type: 'binary', op: '*', left: node, right: parseUnary() };
        } else {
          break;
        }
      }
      return node;
    }

    function parseUnary() {
      const token = peek();
      if (token && token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        next();
        return { type: 'unary', op: token.value, operand: parseUnary() };
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePostfix();
      if (isOperator('^')) {
        next();
        // Right associative, and the exponent may carry a sign: 2^-3.
        return { type: 'binary', op: '^', left: base, right: parseUnary() };
      }
      return base;
    }

    function parsePostfix() {
      let node = parsePrimary();
      while (peek() && peek().type === 'operator' &&
             (peek().value === '!' || peek().value === '%')) {
        const op = next().value;
        node = { type: 'postfix', op: op, operand: node };
      }
      return node;
    }

    function parsePrimary() {
      const token = peek();
      if (!token) {
        throw new CalcError('Incomplete expression');
      }

      if (token.type === 'number' || token.type === 'constant') {
        next();
        return { type: 'number', value: token.value };
      }

      if (token.type === 'function') {
        next();
        if (isOperator('(')) {
          next();
          const arg = parseExpression();
          if (!isOperator(')')) {
            throw new CalcError('Missing closing bracket');
          }
          next();
          return { type: 'call', name: token.name, arg: arg };
        }
        // "√81" or "sin 30" — the function takes a unary expression.
        return { type: 'call', name: token.name, arg: parseUnary() };
      }

      if (token.type === 'operator' && token.value === '(') {
        next();
        const inner = parseExpression();
        if (!isOperator(')')) {
          throw new CalcError('Missing closing bracket');
        }
        next();
        return inner;
      }

      if (token.type === 'operator' && token.value === ')') {
        throw new CalcError('Unexpected closing bracket');
      }

      throw new CalcError('Invalid expression');
    }

    const tree = parseExpression();
    if (position < tokens.length) {
      throw new CalcError('Invalid expression');
    }
    return tree;
  }

  /* ------------------------------------------------------------------ */
  /* Evaluation                                                         */
  /* ------------------------------------------------------------------ */

  function toRadians(angle, degrees) {
    return degrees ? (angle * Math.PI) / 180 : angle;
  }

  function fromRadians(angle, degrees) {
    return degrees ? (angle * 180) / Math.PI : angle;
  }

  // Floating point trigonometry rarely returns a clean value: sin(180°)
  // is 1.22e-16 and tan(45°) is 0.9999999999999999. Snapping results that
  // are within TRIG_SNAP of an integer keeps the display honest.
  function snapTrig(value) {
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < TRIG_SNAP) {
      return rounded;
    }
    return value;
  }

  function factorial(value) {
    if (!Number.isInteger(value)) {
      throw new CalcError('Factorial only works with whole numbers');
    }
    if (value < 0) {
      throw new CalcError('Factorial of a negative number is undefined');
    }
    if (value > MAX_FACTORIAL) {
      throw new CalcError('Factorial input is too large (maximum is 170)');
    }
    let result = 1;
    for (let i = 2; i <= value; i += 1) {
      result *= i;
    }
    return result;
  }

  function applyFunction(name, argument, angleMode) {
    const degrees = angleMode === 'DEG';

    switch (name) {
      case 'sin':
        return snapTrig(Math.sin(toRadians(argument, degrees)));

      case 'cos':
        return snapTrig(Math.cos(toRadians(argument, degrees)));

      case 'tan': {
        const radians = toRadians(argument, degrees);
        // Tangent is undefined wherever cosine is zero (90°, 270°, π/2 …).
        if (Math.abs(Math.cos(radians)) < TRIG_SNAP) {
          throw new CalcError('Tangent is undefined at this angle');
        }
        return snapTrig(Math.tan(radians));
      }

      case 'asin':
        if (argument < -1 || argument > 1) {
          throw new CalcError('asin needs a value between -1 and 1');
        }
        return fromRadians(Math.asin(argument), degrees);

      case 'acos':
        if (argument < -1 || argument > 1) {
          throw new CalcError('acos needs a value between -1 and 1');
        }
        return fromRadians(Math.acos(argument), degrees);

      case 'atan':
        return fromRadians(Math.atan(argument), degrees);

      case 'log':
        if (argument <= 0) {
          throw new CalcError('Logarithm is undefined for zero or negative numbers');
        }
        return Math.log10(argument);

      case 'ln':
        if (argument <= 0) {
          throw new CalcError('Natural logarithm is undefined for zero or negative numbers');
        }
        return Math.log(argument);

      case 'sqrt':
        if (argument < 0) {
          throw new CalcError('Square root of a negative number is not a real number');
        }
        return Math.sqrt(argument);

      case 'abs':
        return Math.abs(argument);

      default:
        throw new CalcError('Unknown function "' + name + '"');
    }
  }

  function evaluateNode(node, context) {
    switch (node.type) {
      case 'number':
        return node.value;

      case 'unary': {
        const value = evaluateNode(node.operand, context);
        return node.op === '-' ? -value : value;
      }

      case 'postfix': {
        const value = evaluateNode(node.operand, context);
        if (node.op === '!') {
          return factorial(value);
        }
        // A bare percentage simply means "per hundred": 50% -> 0.5.
        // In an addition or subtraction it is handled as a relative
        // percentage inside the binary case below.
        return value / 100;
      }

      case 'call':
        return applyFunction(node.name, evaluateNode(node.arg, context), context.angleMode);

      case 'binary': {
        const op = node.op;

        // Calculator style percentages: 200 + 10% -> 220, 200 - 10% -> 180.
        if ((op === '+' || op === '-') && node.right.type === 'postfix' &&
            node.right.op === '%') {
          const left = evaluateNode(node.left, context);
          const percent = evaluateNode(node.right.operand, context) / 100;
          return op === '+' ? left + left * percent : left - left * percent;
        }

        const left = evaluateNode(node.left, context);
        const right = evaluateNode(node.right, context);

        switch (op) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            if (right === 0) {
              throw new CalcError('Cannot divide by zero');
            }
            return left / right;
          case '^': {
            // x^-1 is a reciprocal, so 0 to a negative power is a
            // division by zero rather than a plain overflow.
            if (left === 0 && right < 0) {
              throw new CalcError('Cannot divide by zero');
            }
            const power = Math.pow(left, right);
            if (Number.isNaN(power)) {
              throw new CalcError('Result is not a real number');
            }
            return power;
          }
          default:
            throw new CalcError('Unknown operator "' + op + '"');
        }
      }

      default:
        throw new CalcError('Invalid expression');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  // Users often forget the final ")". Close the expression for them.
  function balanceBrackets(expression) {
    let open = 0;
    for (let i = 0; i < expression.length; i += 1) {
      if (expression[i] === '(') open += 1;
      else if (expression[i] === ')') open -= 1;
    }
    if (open <= 0) return expression;
    return expression + new Array(open + 1).join(')');
  }

  /**
   * Evaluate a display expression.
   * @param {string} expression e.g. "sin(30)+√(81)"
   * @param {'DEG'|'RAD'} angleMode
   * @returns {number}
   */
  function evaluate(expression, angleMode) {
    const source = balanceBrackets(String(expression == null ? '' : expression));
    if (!source.trim()) {
      throw new CalcError('Enter an expression');
    }

    const tokens = tokenize(source);
    if (tokens.length === 0) {
      throw new CalcError('Enter an expression');
    }

    const tree = parse(tokens);
    const value = evaluateNode(tree, { angleMode: angleMode === 'RAD' ? 'RAD' : 'DEG' });

    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new CalcError('Invalid calculation');
    }
    if (!Number.isFinite(value)) {
      throw new CalcError('Result is too large to display');
    }
    return value;
  }

  /**
   * Format a number for the display, removing floating point noise:
   * 0.30000000000000004 -> "0.3", 0.49999999999999994 -> "0.5".
   * Very large and very small values fall back to exponential notation.
   */
  function format(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new CalcError('Invalid result');
    }
    if (!Number.isFinite(value)) {
      throw new CalcError('Result is too large to display');
    }

    let number = value;
    if (Object.is(number, -0)) number = 0;

    const absolute = Math.abs(number);
    if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
      return number
        .toExponential(6)
        .replace(/(\.\d*?)0+e/, '$1e')
        .replace(/\.e/, 'e')
        .replace('e+', 'e');
    }

    // 12 significant digits is enough for a calculator and hides binary
    // floating point artefacts.
    const rounded = parseFloat(number.toPrecision(12));
    return String(rounded);
  }

  global.CalcParser = {
    CalcError: CalcError,
    evaluate: evaluate,
    format: format,
    normalize: normalize
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
