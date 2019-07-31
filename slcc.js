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
	
	var lex_predefined_tokens = make_string_map(
		"import",
		"export",
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
		",",
		".",
		"(",
		")",
		"{",
		"}",
		"[",
		"]",
		"+",
		"-",
		"*",
		"/",
		"&",
		"|",
		"^",
		"~",
		"->",
		"||",
		"&&",
		"==",
		"!=",
		"<",
		">",
		"<=",
		">=",
		"<<",
		">>",
		"++",
		"--",
		"=",
		"+=",
		"-=",
		"*=",
		"/=",
		"&=",
		"^=",
		"<<=",
		">>=",
		";"
	);

	var lex_tokens = null;
	var lex_current_pos = 0;
	var lex_current_col = 1;
	var lex_current_line = 1;
	var lex_token = null;
	var lex_token_col = 0;
	var lex_token_line = 0;

	function Token(type,value,col,line) {
		this.type = type;
		this.value = value;
		this.col = col;
		this.line = line;
	}

	function lex_error() {
		resource.error(
			"SLCC_LEX_ERROR: col %d line %d, %s",
			lex_current_col,
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

	function lex_seek_pos(offset) {
		lex_current_pos += offset;
		lex_current_col += offset;
	}

	function lex_get_token(length) {
		var token_end = lex_current_pos + length;
		var token = source_code.substring(lex_current_pos,token_end);

		lex_token_col = lex_current_col;
		lex_token_line = lex_current_line;
		lex_current_col += length;
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
				lex_current_col = 1;
				++lex_current_line;
			}

			lex_seek_pos(1);
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
		if (lex_peek_char(0) === "'" && lex_peek_char(2) === "'") {
			lex_seek_pos(1);
			lex_get_token(1);
			lex_seek_pos(1);

			return true;
		} else if (lex_peek_char(0) === "'" && lex_peek_char(1) === "\\" && lex_peek_char(3) === "'") {
			lex_seek_pos(1);
			lex_get_token(2);
			lex_seek_pos(1);

			return true;
		} else {
			return false;
		}
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
			} else if (char === "\\") {
				++length;
			}
		} while(!lex_eof() && char !== "\"")

		lex_seek_pos(1);
		lex_get_token(length - 1);
		lex_seek_pos(1);

		return true;
	}

	var LEX_DECIMAL_FIRST = 1;
	var LEX_DECIMAL_LAST = 2;
	var LEX_DECIMAL_DONE = 3;

	function lex_has_decimal() {
		var char = lex_peek_char(0);

		if (!lex_is_num(char)) {
			return 0;
		}

		var length = 0;
		var state = LEX_DECIMAL_FIRST;
		
		do {
			char = lex_peek_char(++length);

			switch(state) {
				case LEX_DECIMAL_FIRST:
					if (char === ".") {
						if (lex_is_num(lex_peek_char(length + 1))) {
							state = LEX_DECIMAL_LAST;
						} else {
							return 0;
						}
					} else if (!lex_is_num(char)) {
						return 0;
					}
				break;

				case LEX_DECIMAL_LAST:
					if (!lex_is_num(char)) {
						state = LEX_DECIMAL_DONE;
					}
				break;
			}
		} while(!lex_eof() && state !== LEX_DECIMAL_DONE)

		return length;
	}

	function lex_get_float_literal() {
		var length = lex_has_decimal();

		if (!length) {
			return false;
		}

		if (lex_peek_char(length) !== "f") {
			return false;
		}

		lex_get_token(length);
		lex_seek_pos(1);
		lex_token = parseFloat(lex_token);

		return true;
	}

	function lex_get_double_literal() {
		var length = lex_has_decimal();

		if (!length) {
			return false;
		}

		lex_get_token(length);
		lex_token = parseFloat(lex_token);

		return true;
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
			} else if (lex_get_char_literal()) {
				type = "char_literal";
			} else if (lex_get_float_literal()) {
				type = "float_literal";
			} else if (lex_get_double_literal()) {
				type = "double_literal";
			} else if (lex_get_integer_literal()) {
				type = "integer_literal";
			} else {
				lex_error("unrecognised character '%c'",lex_peek_char(0));
			}

			lex_tokens.push(new Token(type,lex_token,lex_token_col,lex_token_line));
			lex_skip_whitespace();
		}
	}

	var syn_ast_root = null;
	var syn_symbol_table = null;
	var syn_current_pos = 0;
	var syn_current_pos_save = 0;

	function Ast_Node(type,value,children) {
		this.type = type;
		this.value = value;
		this.children = children || [];
	}

	function syn_error() {
		var token = syn_peek_token(0);

		resource.error(
			"SLCC_SYNTAX_ERROR: col %d line %d, %s",
			token.col,
			token.line,
			resource.format_string.apply(null,arguments)
		);
	}

	function syn_eof() {
		return syn_current_pos === lex_tokens.length;
	}

	function syn_seek_pos(offset) {
		syn_current_pos += offset;
	}

	function syn_save_pos() {
		syn_current_pos_save = syn_current_pos;
	}

	function syn_load_pos() {
		syn_current_pos = syn_current_pos_save;
	}
	
	function syn_peek_token(offset) {
		return lex_tokens[syn_current_pos + offset];
	}
	
	function syn_expect(type) {
		var token = syn_peek_token(0);

		if (token.type !== type) {
			syn_error("expected a '%s' got a '%s' instead",type,token.type);
		}

		syn_seek_pos(1);

		return token;
	}

	function syn_accept(type) {
		var token = syn_peek_token(0);

		if (token.type !== type) {
			return null;
		}

		syn_seek_pos(1);

		return token;
	}

	function syn_declaration() {
		
	}

	function syn_function_definition() {
		
	}

	function syn_external_declaration() {
		syn_save_pos();

		var node = syn_function_definition();

		if (node) {
			return node;
		}

		syn_load_pos();
		node = syn_declaration();

		if (node) {
			return node;
		} else {
			syn_load_pos();
			syn_error("invalid external declaration");
		}
	}

	function syn_translation_unit() {
		var node = new Ast_Node("translation_unit");
		
		while (!syn_eof()) {
			node.children.push(syn_external_declaration());
		}

		return node
	}

	function syntax_analysis() {
		syn_ast_root = syn_translation_unit();
	}

	function semantic_analysis() {

	}

	function asm_js_code_generation() {

	}

	function web_assembly_code_generation() {
		
	}

	function reset_vars(src) {
		source_code = src;
		
		lex_tokens = [];
		lex_current_pos = 0;
		lex_current_col = 1;
		lex_current_line = 1;

		syn_ast_root = null;
		syn_symbol_table = null;
		syn_current_pos = 0;
		syn_current_pos_save = 0;
	}

	return {
		ASM_JS: 1,
		WEB_ASSEMBLY: 2,

		parse: function(src) {
			reset_vars(src);

			lexical_analysis();
			syntax_analysis();
			semantic_analysis();

			return syn_ast_root;
		},

		compile: function(target,src) {
			
		}
	};
});
