const C_SPACE = ' '.charCodeAt(0);

const COOKIE_NAME_MASK = getCookieNameMask();
const COOKIE_VALUE_MASK = getCookieValueMask();

/**	According to RFC, the following chars are forbidden: \x00-\x20, spaces, ()<>@,;:\"/[]?={}
	Forbidden codes: 0..32, 32, 34, 40, 41, 44, 47, 58, 59, 60, 61, 62, 63, 64, 91, 92, 93, 123, 125
 **/
function getCookieNameMask()
{	const mask = new Uint8Array(128);
	for (let i=0; i<=32; i++)
	{	mask[i] = 1;
	}
	mask[34] = 1;
	mask[40] = 1;
	mask[41] = 1;
	mask[44] = 1;
	mask[47] = 1;
	for (let i=58; i<=64; i++)
	{	mask[i] = 1;
	}
	mask[91] = 1;
	mask[92] = 1;
	mask[93] = 1;
	mask[123] = 1;
	mask[125] = 1;
	return mask;
}

/**	According to RFC, the following chars are forbidden: \x00-\x20, spaces, ",;\
	Forbidden codes: 0..32, 32, 34, 44, 59, 92
 **/
function getCookieValueMask()
{	const mask = new Uint8Array(128);
	for (let i=0; i<=32; i++)
	{	mask[i] = 1;
	}
	mask[34] = 1;
	mask[44] = 1;
	mask[59] = 1;
	mask[92] = 1;
	return mask;
}

export type CookieOptions =
{	expires?: Date,
	maxAge?: number,
	domain?: string,

	/**	@default "/"
	 **/
	path?: string,
	secure?: boolean,
	httpOnly?: boolean,
	sameSite?: string,
};

/**	@category Errors
 **/
export class CookieError extends Error
{
}

/**	A Cookies implementation that can parse and set cookies in HTTP headers.
	This object can be constructed from the "Cookie" header of an HTTP request.
	Then it can be used to get, set, and delete cookies.
	Then you can apply the changes to the "Set-Cookie" headers of an HTTP response by calling the {@link applyToResponse()} method.
 **/
export class SuperCookies extends Map<string, string>
{	#orig = new Map<string, {rawName: string, value: string}>;
	#options = new Map<string, CookieOptions>;

	/**	Creates a Cookies object by parsing the given "Cookie" header.
		@param cookieHeader The value of the "Cookie" header from an HTTP request.
	 **/
	constructor(cookieHeader?: string|null)
	{	super();
		parseCookieHeader(cookieHeader, this.#orig, this);
	}

	/**	Sets a cookie value with optional parameters.

		Setting a cookie with an empty value will result in deleting it.

		Default path option is "/".

		@param name The cookie name.
		@param value The cookie value.
		@param options Optional cookie parameters (expires, maxAge, domain, path, secure, httpOnly, sameSite).
	 **/
	override set(name: string, value: string, options?: CookieOptions)
	{	super.set(name, value);
		if (options)
		{	if (options.domain && options.domain.indexOf(';')!=-1)
			{	throw new CookieError('Domain name in cookie cannot contain semicolon');
			}
			if (options.path && options.path.indexOf(';')!=-1)
			{	throw new CookieError('Path in cookie cannot contain semicolon');
			}
			if (options.sameSite && options.sameSite.indexOf(';')!=-1)
			{	throw new CookieError('SameSite in cookie must be one of: Strict, Lax, None');
			}
			this.#options.set(name, options);
		}
		return this;
	}

	override delete(key: string)
	{	this.#options.delete(key);
		return super.delete(key);
	}

	/**	Applies the cookie changes to the given HTTP response headers.
		@param response An object containing the HTTP response headers. If the `headers` property is not present, it will be created.
	 **/
	applyToResponse(response: {headers?: Headers|HeadersInit})
	{	applyToResponse(response, this.#orig, this, this.#options);
	}
}

function parseCookieHeader(cookieHeader: string|null|undefined, cookiesOrig: Map<string, {rawName: string, value: string}>, cookies: Map<string, string>)
{	if (cookieHeader)
	{	let i = 0;
		while (i < cookieHeader.length)
		{	let iEnd = cookieHeader.indexOf('=', i);
			if (iEnd == -1)
			{	break;
			}
			const rawName = cookieHeader.slice(i, iEnd);
			i = iEnd + 1;
			iEnd = cookieHeader.indexOf(';', i);
			if (iEnd == -1)
			{	iEnd = cookieHeader.length;
			}
			const name = decodeURIComponent(rawName);
			const value = decodeURIComponent(cookieHeader.slice(i, iEnd));
			cookies.set(name, value);
			cookiesOrig.set(name, {rawName, value});
			i = iEnd + 1; // skip the ';' delimiter
			// skip spaces
			while (cookieHeader.charCodeAt(i) == C_SPACE)
			{	i++;
			}
		}
	}
}

function applyToResponse(response: {headers?: Headers|HeadersInit}, cookiesOrig: Map<string, {rawName: string, value: string}>, cookies: Map<string, string>, options: Map<string, CookieOptions>)
{	for (const [name, {rawName}] of cookiesOrig)
	{	if (!cookies.has(name))
		{	let headers: Headers;
			if (response.headers instanceof Headers)
			{	headers = response.headers;
			}
			else
			{	headers = new Headers(response.headers && Object.entries(response.headers));
				response.headers = headers;
			}
			headers.append('set-cookie', `${rawName}=; Path=/; Expires=Sat, 01 Jan 2000 00:00:00 GMT`);
		}
	}
	for (const [name, value] of cookies)
	{	const orig = cookiesOrig.get(name);
		if (orig?.value !== value)
		{	let headers: Headers;
			if (response.headers instanceof Headers)
			{	headers = response.headers;
			}
			else
			{	headers = new Headers(response.headers && Object.entries(response.headers));
				response.headers = headers;
			}
			if (orig && orig.rawName!==name)
			{	// the name has changed - delete the old cookie
				headers.append('set-cookie', `${orig.rawName}=; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Max-Age=0; Path=/`);
			}
			let str = `${encodeCookie(name, COOKIE_NAME_MASK)}=${encodeCookie(value, COOKIE_VALUE_MASK)}`;
			const option = options.get(name);
			if (option)
			{	let {expires, maxAge, domain, path, secure, httpOnly, sameSite} = option;
				if (!value)
				{	str += `; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Max-Age=0`;
				}
				else
				{	if (maxAge != undefined)
					{	expires = new Date(Date.now() + maxAge*1000);
					}
					else if (expires)
					{	maxAge = Math.ceil((expires.getTime() - Date.now()) / 1000);
					}
					if (expires)
					{	str += `; Expires=${expires.toUTCString()}; Max-Age=${maxAge}`;
					}
				}
				if (domain)
				{	str += `; Domain=${domain}`;
				}
				if (path == undefined)
				{	str += `; Path=/`;
				}
				else if (path)
				{	str += `; Path=${path}`;
				}
				if (secure)
				{	str += `; Secure`;
				}
				if (httpOnly)
				{	str += `; HttpOnly`;
				}
				if (sameSite)
				{	str += `; SameSite=${sameSite}`;
				}
			}
			else if (!value)
			{	str += `; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Max-Age=0; Path=/`;
			}
			headers.append('set-cookie', str);
		}
	}
}

function encodeCookie(value: string, mask: Uint8Array)
{	for (let i=0, iEnd=value.length; i<iEnd; i++)
	{	let c = value.charCodeAt(i);
		if (c>=128 || mask[c]===1)
		{	// there's invalid char at "i"
			let newValue = value.slice(0, i); // cannot return "value" as is, so create "newValue"
			while (i < iEnd)
			{	// newValue += invalid range
				let from = i;
				for (i++; i<iEnd; i++)
				{	c = value.charCodeAt(i);
					if (!(c>=128 || mask[c]===1))
					{	break;
					}
				}
				newValue += encodeURIComponent(value.slice(from, i));
				// newValue += valid range
				from = i;
				for (i++; i<iEnd; i++)
				{	c = value.charCodeAt(i);
					if (c>=128 || mask[c]===1)
					{	break;
					}
				}
				newValue += value.slice(from, i);
			}
			return newValue;
		}
	}
	// all chars are valid
	return value;
}
