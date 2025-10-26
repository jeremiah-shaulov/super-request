const RE_CONTENT_TYPE_PARAM = /;\s*([a-zA-Z0-9\-]+)\s*=\s*("[^"]*"|[^\s;"]*)\s*/y;

const C_QT = '"'.charCodeAt(0);

/**	Parses a Content-Type header value into its components.

	Extracts the MIME type and relevant parameters: charset and boundary.
	For example, "text/html; charset=utf-8" returns `{type: "text/html", charset: "utf-8", boundary: undefined}`.

	@param type The full Content-Type header value
	@returns An object containing the parsed type, charset (if present), and boundary (if present for multipart types)
 **/
export function parseContentType(type: string)
{	let charset: string|undefined;
	let boundary: string|undefined;
	const pos = type.indexOf(';');
	if (pos != -1)
	{	RE_CONTENT_TYPE_PARAM.lastIndex = pos;
		while (true)
		{	const m = RE_CONTENT_TYPE_PARAM.exec(type);
			if (!m)
			{	break;
			}
			const param = m[1].toLowerCase();
			let value = m[2];
			if (value.charCodeAt(0) == C_QT)
			{	value = value.slice(1, -1);
			}
			if (param == 'charset')
			{	charset = value;
			}
			else if (param == 'boundary')
			{	boundary = value;
			}
		}
		type = type.slice(0, pos);
	}
	return {type, charset, boundary};
}
