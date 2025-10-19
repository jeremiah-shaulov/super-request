const RE_CONTENT_TYPE_PARAM = /;\s*([a-zA-Z0-9\-]+)\s*=\s*("[^"]*"|[^\s;"]*)\s*/y;

const C_QT = '"'.charCodeAt(0);

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
