/*
   Copyright 2019 Casey Smalley

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

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
		"auto",
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
		"%",
		"&",
		"|",
		"^",
		"~",
		"?",
		":",
		"!",
		";",
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
		">>="
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
		return lex_current_pos >= source_code.length;
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
	var syn_type_table = null;
	var syn_pos_stack = [];
	var syn_current_pos = 0;
	var syn_token = null;

	function Ast_Node(type,value) {
		this.type = type;
		this.value = null;
		this.children = [];

		var i = 1;

		if (!(arguments[i] instanceof(Ast_Node))) {
			this.value = arguments[i++];
		}

		for (; i < arguments.length; ++i) {
			this.children.push(arguments[i]);
		}
	}

	function syn_eof() {
		return syn_current_pos >= lex_tokens.length;
	}

	function syn_peek_type(offset) {
		var token = lex_tokens[syn_current_pos + offset];

		if (token) {
			return token.type;
		} else {
			return "?_UNKNOWN_?";
		}
	}

	function syn_peek_value(offset) {
		var token = lex_tokens[syn_current_pos + offset];

		if (token) {
			return token.value;
		} else {
			return "?_UNKNOWN_?";
		}
	}

	function syn_error() {
		var token = lex_tokens[syn_current_pos] || syn_token;

		resource.error(
			"SLCC_SYNTAX_ERROR: col %d line %d, %s",
			token.col,
			token.line,
			resource.format_string.apply(null,arguments)
		);
	}

	function syn_push() {
		syn_pos_stack.push(syn_current_pos);
	}

	function syn_pop() {
		syn_pos_stack.pop();
	}

	function syn_restore() {
		syn_current_pos = syn_pos_stack.pop();
		syn_token = lex_tokens[syn_current_pos];
	}

	function syn_consume() {
		syn_token = lex_tokens[syn_current_pos++];
		return syn_token;
	}

	function syn_accept() {
		var token = lex_tokens[syn_current_pos];

		if (token) {
			for (var i = 0; i < arguments.length; ++i) {
				if (arguments[i] === token.type) {
					syn_consume();
					return true;
				}
			}
		}

		return false;
	}

	function syn_expect(type) {
		var token = lex_tokens[syn_current_pos];

		if (!token || type !== token.type) {
			syn_error("expected a '%s'",type);
		}

		syn_consume();
		return true;
	}

	function syn_primary_expression() {
		if (syn_accept("identifier")) {
			return new Ast_Node("variable",syn_token.value);
		} else if (syn_accept(
			"char_literal",
			"integer_literal",
			"float_literal",
			"string_literal"
		)) {
			return new Ast_Node(syn_token.type,syn_token.value);
		} else if (syn_accept("(")) {
			var node = syn_expression();
			syn_expect(")");

			return node;
		} else {
			syn_error("expected an identifier or a literal");
		}
	}

	function syn_postfix_expression() {
		var node = syn_primary_expression();
		var has_match = true;

		while(has_match) {
			has_match = false;

			if (syn_accept("[")) {
				has_match = true;
				node = new Ast_Node("subscript",node,syn_expression());
				syn_expect("]");
			} else if (syn_accept("(")) {
				has_match = true;
				node = new Ast_Node("function_call",node);

				if (syn_peek_type(0) !== ")") {
					node.children = syn_argument_expression_list();
				}	
				
				syn_expect(")");
			} else if (syn_accept(".")) {
				has_match = true;
				syn_expect("identifier");
				node = new Ast_Node("dot_accessor",syn_token.value,node);
			} else if (syn_accept("->")) {
				has_match = true;
				syn_expect("identifier");
				node = new Ast_Node("pointer_accessor",syn_token.value,node);
			} else if (syn_accept("++")) {
				has_match = true;
				node = new Ast_Node("postfix_operator",syn_token.value,node);
			} else if (syn_accept("--")) {
				has_match = true;
				node = new Ast_Node("postfix_operator",syn_token.value,node);
			}
		}

		return node;
	}

	function syn_argument_expression_list() {
		var nodes = [];

		do {
			nodes.push(syn_assignment_expression());
		} while(syn_accept(","))

		return nodes;
	}

	function syn_unary_expression() {
		var node = syn_unary_operator();

		if (syn_accept("++","--")) {
			node = new Ast_Node("prefix_operator",syn_token.value);
			node.children.push(syn_cast_expression());
		} else if (node) {
			if (node.type === "sizeof_operator" &&  syn_accept("(")) {
				node.children.push(syn_type_name());
				syn_expect(")");
			} else {
				node.children.push(syn_unary_expression());
			}
		} else {
			node = syn_postfix_expression();
		}

		return node;
	}

	function syn_unary_operator() {
		if (syn_accept(
			"&",
			"*",
			"+",
			"-",
			"~",
			"!",
		)) {
			return new Ast_Node("unary_operator",syn_token.value);
		} else if (syn_accept("sizeof")) {
			return new Ast_Node("sizeof_operator");
		}
	}

	function syn_cast_expression() {
		var node = undefined;
		syn_push();

		if (syn_accept("(")) {
			try {
				node = syn_type_name();
			} catch(error) {
				syn_restore();
				return syn_unary_expression();
			}

			syn_expect(")");
			node = new Ast_Node("cast",node);
			node.children.push(syn_unary_expression());
		} else {
			node = syn_unary_expression();
		}

		syn_pop();
		return node;
	}

	function syn_multiplicative_expression() {
		var node = syn_cast_expression();

		if (syn_accept(
			"*",
			"/",
			"%"
		)) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_multiplicative_expression());
		}

		return node;
	}

	function syn_additive_expression() {
		var node = syn_multiplicative_expression();

		if (syn_accept(
			"+",
			"-"
		)) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_additive_expression());
		}

		return node;
	}

	function syn_shift_expression() {
		var node = syn_additive_expression();

		if (syn_accept(
			"<<",
			">>"
		)) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_shift_expression());
		}

		return node;
	}

	function syn_relational_expression() {
		var node = syn_shift_expression();

		if (syn_accept(
			"<",
			">",
			"<=",
			">="
		)) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_relational_expression());
		}

		return node;
	}

	function syn_equality_expression() {
		var node = syn_relational_expression();

		if (syn_accept(
			"==",
			"!="
		)) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_equality_expression());
		}

		return node;
	}

	function syn_and_expression() {
		var node = syn_equality_expression();

		if (syn_accept("&")) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_and_expression());
		}

		return node;
	}

	function syn_exclusive_or_expression() {
		var node = syn_and_expression();

		if (syn_accept("^")) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_exclusive_or_expression());
		}

		return node;
	}

	function syn_inclusive_or_expression() {
		var node = syn_exclusive_or_expression();

		if (syn_accept("|")) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_inclusive_or_expression());
		}

		return node;
	}

	function syn_logical_and_expression() {
		var node = syn_inclusive_or_expression();

		if (syn_accept("&&")) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_logical_and_expression());
		}

		return node;
	}

	function syn_logical_or_expression() {
		var node = syn_logical_and_expression();

		if (syn_accept("||")) {
			node = new Ast_Node(syn_token.value,node);
			node.children.push(syn_logical_or_expression());
		}

		return node;
	}

	function syn_conditional_expression() {
		var node = syn_logical_or_expression();

		if (syn_accept("?")) {
			node = new Ast_Node("ternary_operator",node);
			node.children.push(syn_expression());
			syn_expect(":");
			node.children.push(syn_conditional_expression());
		}

		return node;
	}

	function syn_assignment_expression() {
		var node = null;
		syn_push();

		try {
			node = syn_unary_expression();
		} catch(error) {
			syn_restore();
			return syn_conditional_expression();
		}

		if (!syn_accept(
			"=",
			"*=",
			"/=",
			"%=",
			"+=",
			"-=",
			"<<=",
			">>=",
			"^=",
			"|="
		)) {
			syn_restore();
			return syn_conditional_expression();
		}

		node = new Ast_Node(syn_token.value,node);
		node.children.push(syn_assignment_expression());

		syn_pop();
		return node;
	}

	function syn_expression() {
		var node = new Ast_Node("expression");

		do {
			node.children.push(syn_assignment_expression());
		} while(syn_accept(","));

		return node;
	}

	function syn_constant_expression() {
		return syn_conditional_expression();
	}

	function syn_declaration() {
		var node = new Ast_Node("declaration");
		
		node.children.push(syn_declaration_specifiers());

		if (!syn_accept(";")) {
			node.children = syn_init_declarator_list();
			syn_expect(";");
		}

		return node;
	}

	function syn_declaration_specifiers() {
		var node = new Ast_Node("declaration_specifiers");
		var child = null;
		var has_one = false;
		var has_match = false;

		do {
			has_match = false;

			child = syn_storage_class_specifier()
			     || syn_type_specifier()
			     || syn_type_qualifier();

			if (child) {
				has_one = true;
				has_match = true;
				node.children.push(child);
			}
		} while(has_match)

		if (has_one) {
			return node;
		} else {
			syn_error("must be a valid type or modifier");
		}
	}

	function syn_init_declarator_list() {
		var nodes = [];

		do {
			nodes.push(syn_init_declarator());
		} while(syn_accept(","))

		return nodes;
	}

	function syn_init_declarator() {
		var node = syn_declarator();

		if (syn_accept("=")) {
			node.children.push(syn_initializer());
		}

		return node;
	}

	function syn_storage_class_specifier() {
		if (syn_accept(
			"typedef",
			"extern",
			"static",
			"auto",
			"register"
		)) {
			return new Ast_Node(syn_token.value);
		}
	}

	function syn_type_specifier() {
		if (syn_accept(
			"void",
			"char",
			"short",
			"int",
			"long",
			"float",
			"double",
			"signed",
			"unsigned",
			"struct",
			"union"
		)) {
			return new Ast_Node(syn_token.value);
		} else if (syn_peek_type(0) === "enum") {
			return syn_enum_specifier();
		} else if (syn_type_table[syn_peek_value(0)]) {
			return new Ast_Node(syn_token.value);
		}

	}
	function syn_struct_or_union_specifier() {
		var node = syn_struct_or_union();
		var has_one = false;

		if (syn_accept("identifier")) {
			has_one = true;
			node.value = syn_token.value;
		}

		if (syn_accept("{")) {
			has_one = true;
			node.children.push(syn_struct_declaration_list());
			syn_expect("}");
		}

		if (has_one) {
			return node;
		} else {
			syn_error("invalid struct/union");
		}
	}

	function syn_struct_or_union() {
		if (syn_accept(
			"struct",
			"union"
		)) {
			return new Ast_Node(syn_token.value);
		} else {
			syn_error("must be a struct or union");
		}
	}

	function syn_struct_declaration_list() {
		var node = new Ast_Node("struct_declaration_list");
		var has_one = false;
		var has_error = false;
		var child_error = null;

		do {
			try {
				syn_push();
				node.children.push(syn_struct_declaration());
				syn_pop();
			} catch(error) {
				syn_restore();
				has_error = true;
				child_error = error;
			}
		} while(!has_error);

		if (has_one) {
			return node;
		} else {
			syn_error(child_error);
		}
	}

	function syn_struct_declaration() {
		var node = new Ast_Node("struct_declaration");

		node.children.push(syn_specifier_qualifier_list());
		node.children.push(syn_struct_declarator_list());

		return node;
	}

	function syn_specifier_qualifier_list() {
		var node = new Ast_Node("specifier_qualifier_list");
		var child = null;
		var has_one = false;
		var has_match = false;

		do {
			has_match = false;
			
			child = syn_type_specifier()
			     || syn_type_qualifier();

			if (child) {
				has_one = true;
				has_match = true;
				node.children.push(child);
			}
		} while(has_match)

		if (has_one) {
			return node;
		} else {
			syn_error("must be specifier or a qualifier");
		}
	}

	function syn_struct_declarator_list() {
		var node = new Ast_Node("struct_declarator_list");
		var has_one = false;
		var has_error = false;
		var child_error = null;

		do {
			try {
				syn_push();
				node.children.push(syn_struct_declarator());
				syn_pop();
			} catch(error) {
				syn_restore();
				has_error = true;
				child_error = error;
			}
		} while(!has_error);

		if (has_one) {
			return node;
		} else {
			syn_error(child_error);
		}

	}

	function syn_struct_declarator() {
		if (syn_accept(":")) {
			return syn_constant_expression();
		}

		var node = syn_declarator();

		if (syn_accept(":")) {
			node.children.push(syn_constant_expression());
		}

		return node;
	}

	function syn_enum_specifier() {
		syn_expect("enum");

		var node = new Ast_Node("enum_specifier");
		var has_one = false;

		if (syn_accept("identifier")) {
			has_one = true;
			node.value = syn_token.value;
		}

		if (syn_accept("{")) {
			has_one = true;
			node.children.push(syn_enumerator_list());
			syn_expect("}");
		}

		if (has_one) {
			return node;
		} else {
			syn_error("missing enum identifier or body");
		}
	}

	function syn_enumerator_list() {
		var node = new Ast_Node("enumerator_list");

		do {
			node.children.push(syn_enumerator());
		} while(syn_accept(","))

		return node;
	}

	function syn_enumerator() {
		var node = new Ast_Node("enumerator");

		syn_expect("identifier");
		node.value = syn_token.value;

		if (syn_accept("=")) {
			node.children.push(syn_constant_expression());
		}

		return node;
	}

	function syn_type_qualifier() {
		if (syn_accept(
			"const",
			"volatile"
		)) {
			return new Ast_Node(syn_token.value);
		}
	}

	function syn_declarator() {
		
	}

	function syn_direct_declarator() {
		
	}

	function syn_pointer() {
		var node = new Ast_Node("pointer");
		var has_match = false;
	}

	function syn_parameter_type_list() {
		
	}

	function syn_parameter_list() {
		
	}

	function syn_parameter_declaration() {
		
	}

	function syn_identifier_list() {
		
	}

	function syn_type_name() {
		syn_error("");
	}

	function syn_abstract_declarator() {
		
	}

	function syn_direct_abstract_declarator() {
		
	}

	function syn_initializer() {
		
	}

	function syn_initializer_list() {
		
	}

	function syn_statement() {
		
	}

	function syn_labeled_statement() {
		
	}

	function syn_compound_statement() {
		
	}

	function syn_declaration_list() {
		
	}

	function syn_statement_list() {
		
	}

	function syn_expression_statement() {
		
	}

	function syn_selection_statement() {
		
	}

	function syn_iteration_statement() {
		
	}

	function syn_jump_statement() {
		
	}

	function syn_translation_unit() {
		
	}

	function syn_external_declaration() {
		
	}

	function syn_function_definition() {
		
	}

	function syntax_analysis() {
		syn_type_table = {};
		syn_pos_stack = [];

		if (!syn_eof()) {
			syn_ast_root = syn_enum_specifier();
		}
	}

	function semantic_analysis() {

	}

	function vm_code_generation() {
		
	}

	function asm_js_code_generation() {

	}

	function wasm_code_generation() {
		
	}

	function reset_vars(src) {
		source_code = src;
		
		lex_tokens = [];
		lex_current_pos = 0;
		lex_current_col = 1;
		lex_current_line = 1;

		syn_ast_root = null;
		syn_type_table = null;
		syn_pos_stack = null;
		syn_current_pos = 0;
	}

	return {
		VM: 1,
		ASM_JS: 2,
		WASM: 3,

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
