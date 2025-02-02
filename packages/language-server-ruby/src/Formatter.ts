import path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Range, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver';
import { RubyEnvironment } from 'vscode-ruby-common';
import {
	documentConfigurationCache,
	workspaceRubyEnvironmentCache,
	RubyConfiguration,
} from './SettingsCache';
import { documents } from './DocumentManager';
import { URI } from 'vscode-uri';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import {
	IFormatter,
	FormatterConfig,
	NullFormatter,
	RuboCop,
	Standard,
	Rufo,
	RubyFMT,
	Prettier,
} from './formatters';

const FORMATTER_MAP = {
	rubocop: RuboCop,
	standard: Standard,
	rufo: Rufo,
	rubyfmt: RubyFMT,
	prettier: Prettier,
};

function getFormatter(
	document: TextDocument,
	env: RubyEnvironment,
	config: RubyConfiguration,
	range?: Range
): IFormatter {
	// Only format if we have a formatter to use and an execution root
	if (typeof config.format === 'string' && config.workspaceFolderUri) {
		const executionRoot =
			config.executionRoot?.toLowerCase() === 'workspace root'
				? URI.parse(config.workspaceFolderUri).fsPath
				: path.dirname(URI.parse(document.uri).fsPath);
		const formatterConfig: FormatterConfig = {
			env,
			executionRoot,
			config: {
				command: config.format,
				useBundler: config.useBundler,
			},
		};

		if (range) {
			formatterConfig.range = range;
		}

		return new FORMATTER_MAP[config.format](document, formatterConfig);
	} else {
		return new NullFormatter();
	}
}

const Formatter = {
	format(ident: TextDocumentIdentifier, range?: Range): Observable<TextEdit[]> {
		const document = documents.get(ident.uri);

		return from(documentConfigurationCache.get(ident.uri)).pipe(
			mergeMap(config =>
				from(workspaceRubyEnvironmentCache.get(config.workspaceFolderUri)).pipe(
					mergeMap(env => {
						return getFormatter(document, env, config, range).format();
					})
				)
			)
		);
	},
};
export default Formatter;
