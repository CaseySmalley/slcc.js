resource.define([

],

function() {

	"use strict";

	function make_string_map() {
		var map = {};
		
		for (var i = 0; i < arguments.length; ++i) {
			map[arguments[i]] = true;
		}

		return map;
	}

	var source_code = null;
	var symbol_table = null;

	var lex_predefined_tokens = make_string_map(
		"sizeof",
		"typedef",
		"static",
		"extern",
		"struct",
		"union",
		"enum",
		"register",
		"volatile",
		"const",
		"unsigned",
		"signed",
		"void",
		"char",
		"short",
		"int",
		"long",
		"float",
		"double",
		"do",
		"while",
		"for",
		"if",
		"else",
		"switch",
		"break",
		"default",
		"continue",
		"return",
		"(",
		")",
		"{",
		"}",
		";"
	);

	var lex_tokens = null;
	var lex_current_pos = 0;
	var lex_current_line = 0;
	var lex_token = null;

	function Token(type,value) {
		this.type = type;
		this.value = value;
	}

	function lex_error() {
		resource.error(
			"slcc lex error %d: %s",
			lex_current_line,
			resource.format_string.apply(null,arguments)
		);
	}

	function lex_eof() {
		return lex_current_pos === source_code.length;
	}

	function lex_peek_char(offset) {
		return source_code[lex_current_pos + offset];
	}

	function lex_peek_token(length) {
		return source_code.substring(lex_current_pos,lex_current_pos + length);
	}

	function lex_get_token(length) {
		var token_end = lex_current_pos + length;
		var token = source_code.substring(lex_current_pos,token_end);

		lex_current_pos = token_end;
		lex_token = token;
	}

	function lex_is_predefined_token() {
		return lex_predefined_tokens[lex_token] === true;
	}
	
	function lex_is_newline(char) {
		return char === "\n"
		    || char === "\r"
		    || char === "\n\r";
	}

	function lex_is_alpha(char) {
		return (char >= "a" && char <= "z")
		    || (char >= "A" && char <= "Z");
	}

	function lex_is_num(char) {
		return char >= "0" && char <= "9";
	}

	function lex_skip_whitespace() {
		var char = lex_peek_char(0);

		while(!lex_eof() && (char === " " || char === "	" || lex_is_newline(char))) {
			if (lex_is_newline(char)) {
				++lex_current_line;
			}

			++lex_current_pos;
			char = lex_peek_char(0);
		}
	}

	function lex_get_identifier() {
		var char = lex_peek_char(0);

		if (!lex_is_alpha(char) && char !== "_") {
			return false;
		}

		var length = 0;

		do {
			char = lex_peek_char(++length);
		} while(!lex_eof() && (lex_is_alpha(char) || lex_is_num(char) || char === "_"))
		
		lex_get_token(length);
		
		return true;
	}

	function lex_get_predefined_token() {
		var token = lex_peek_char(0);

		if (!lex_predefined_tokens[token]) {
			return false;
		}

		var length = 1;

		do {
			token = lex_peek_token(++length);
		} while(!lex_eof() && lex_predefined_tokens[token]);

		lex_get_token(--length);

		return true;
	}

	function lex_get_char_literal() {

	}

	function lex_get_string_literal() {
		var char = lex_peek_char(0);

		if (char !== "\"") {
			return false;
		}

		var length = 0;

		do {
			char = lex_peek_char(++length);

			if (lex_is_newline(char)) {
				lex_error("newline in string");
			}
		} while(!lex_eof() && char !== "\"")

		++lex_current_pos;
		lex_get_token(length - 1);

		return true;
	}

	function lex_get_float_literal() {

	}

	function lex_get_double_literal() {
		
	}

	function lex_get_integer_literal() {
		var char = lex_peek_char(0);

		if (!lex_is_num(char)) {
			return false;
		}

		var length = 0;
		char = lex_peek_char(1);

		if (char === "x" || char === "b") {
			length = 1;
		}

		do {
			char = lex_peek_char(++length);
		} while(!lex_eof() && lex_is_num(char))

		lex_get_token(length);
		lex_token = parseInt(lex_token);

		return true;
	}

	function lexical_analysis() {
		//debugger;

		lex_skip_whitespace();

		while (!lex_eof()) {
			var type = null;

			if (lex_get_identifier()) {
				if (lex_predefined_tokens[lex_token]) {
					type = lex_token;
				} else {
					type = "identifier";
				}
			} else if (lex_get_predefined_token()) {
				type = lex_token;
			} else if (lex_get_string_literal()) {
				type = "string_literal";
			} else if (lex_get_integer_literal()) {
				type = "integer_literal";
			} else {
				lex_error("unrecognised character '%c'",lex_peek_char(0));
			}

			lex_tokens.push(new Token(type,lex_token));
			lex_skip_whitespace();
		}
	}

	function syntax_analysis() {

	}

	function semantic_analysis() {

	}

	function asm_js_code_generation() {

	}

	function web_assembly_code_generation() {
		
	}

	function reset_vars(src) {
		source_code = src;
		symbol_table = {};
		lex_tokens = [];
		lex_current_pos = 0;
		lex_current_line = 0;
	}

	return {
		ASM_JS: 1,
		WEB_ASSEMBLY: 2,

		parse: function(src) {
			reset_vars(src);
			lexical_analysis();

			return lex_tokens;
		},

		compile: function(target,src) {
			
		}
	};
});
