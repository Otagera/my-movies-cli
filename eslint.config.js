import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
});

export default [
	...compat.extends(
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"prettier"
	),
	{
		plugins: {
			prettier,
		},
		rules: {
			"no-unused-vars": [
				"error",
				{
					args: "after-used", // Ignore unused arguments if they are defined after a used argument
					varsIgnorePattern: "^_", // Ignore variables starting with an underscore
					argsIgnorePattern: "^_", // Ignore arguments starting with an underscore
				},
			],
			"prettier/prettier": "error",
		},
	},
];
