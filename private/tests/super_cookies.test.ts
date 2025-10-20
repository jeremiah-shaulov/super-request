import {SuperCookies, CookieError} from '../super_cookies.ts';
import {assertEquals, assert} from './deps.ts';

function getSetCookie(cookies: SuperCookies): string[]
{	const response = new Response;
	cookies.applyToResponse(response);
	return response.headers.getSetCookie();
}

Deno.test
(	'Cookies 1',
	() =>
	{	const cookies = new SuperCookies('coo-1= val <1> ; coo-2=val <2>.');
		assertEquals(cookies.size, 2);
		assertEquals(cookies.get('coo-1'), ' val <1> ');
		assertEquals(cookies.get('coo-2'), 'val <2>.');
		cookies.set('coo-1', 'New value', {domain: 'example.com'});
		assertEquals(cookies.size, 2);
		assert(cookies.has('coo-1'));
		assert(cookies.has('coo-2'));
		assertEquals(getSetCookie(cookies), ['coo-1=New%20value; Domain=example.com; Path=/']);
		cookies.clear();
		assertEquals(cookies.size, 0);
	}
);

Deno.test
(	'Cookies 2',
	() =>
	{	const cookies = new SuperCookies('coo-1= val <1> ; coo-2=val <2>.; ');
		assertEquals(cookies.size, 2);
		assertEquals(cookies.get('coo-1'), ' val <1> ');
		assertEquals(cookies.get('coo-2'), 'val <2>.');
		cookies.set('coo[1]', 'val[1]', {path: '', secure: true, httpOnly: true, sameSite: 'strict'});
		assertEquals(cookies.size, 3);
		assertEquals(getSetCookie(cookies), ['coo%5B1%5D=val[1]; Secure; HttpOnly; SameSite=strict']);
		cookies.delete('fake');
		assertEquals(cookies.size, 3);
		cookies.delete('coo[1]');
		assertEquals(cookies.size, 2);
	}
);

Deno.test
(	'Cookies: unicode',
	() =>
	{	const cookies = new SuperCookies('א= א ; ב=ב;');
		assertEquals(cookies.size, 2);
		assertEquals(cookies.get('א'), ' א ');
		assertEquals(cookies.get('ב'), 'ב');
		cookies.set('ג', 'ג', {path: '/'});
		assertEquals(cookies.size, 3);
		assertEquals(getSetCookie(cookies), [`%D7%92=%D7%92; Path=/`]);
	}
);

Deno.test
(	'Cookies: Max-Age',
	() =>
	{	const cookies = new SuperCookies;
		assertEquals(cookies.size, 0);
		const now = Date.now();
		cookies.set('coo', 'val', {maxAge: 30});
		assertEquals(cookies.size, 1);
		let h = getSetCookie(cookies)[0];
		let expires;
		h = h?.replace(/Expires=([^;]+)/, (_a, m) => {expires=m; return 'Expires='});
		assertEquals(h, 'coo=val; Expires=; Max-Age=30; Path=/');
		assert(expires == new Date(now + 30_000).toUTCString() || expires == new Date(now + 29_000).toUTCString());
	}
);

Deno.test
(	'Cookies: Expires',
	() =>
	{	const cookies = new SuperCookies;
		assertEquals(cookies.size, 0);
		const expires = new Date(Date.now() + 30_000);
		cookies.set('coo', 'val', {expires});
		assertEquals(cookies.size, 1);
		let h = getSetCookie(cookies)[0];
		let max_age;
		h = h?.replace(/Max-Age=([^;]+)/, (_a, m) => {max_age=m; return 'Max-Age='});
		assertEquals(h, `coo=val; Expires=${expires.toUTCString()}; Max-Age=; Path=/`);
		assert(max_age=='30' || max_age=='29');
	}
);

Deno.test
(	'Cookies: empty value',
	() =>
	{	const cookies = new SuperCookies('coo=val');
		assertEquals(cookies.size, 1);
		cookies.set('coo', '', {maxAge: 30});
		assertEquals(cookies.size, 1);
		assertEquals(getSetCookie(cookies), ['coo=; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Max-Age=0; Path=/']);
	}
);

Deno.test
(	'Cookies: invalid',
	() =>
	{	let cookies = new SuperCookies;
		// invalid Domain
		let error;
		try
		{	cookies.set('coo', 'val', {domain: 'a;b'});
		}
		catch (e)
		{	error = e;
		}
		assert(error instanceof CookieError);
		// invalid Path
		error = undefined;
		try
		{	cookies.set('coo', 'val', {path: 'a;b'});
		}
		catch (e)
		{	error = e;
		}
		assert(error instanceof CookieError);
		// invalid SameSite
		error = undefined;
		try
		{	cookies.set('coo', 'val', {sameSite: 'a;b'});
		}
		catch (e)
		{	error = e;
		}
		assert(error instanceof CookieError);
		// no '='
		cookies = new SuperCookies('coo-1=val <1>; coo-2');
		assertEquals(cookies.size, 1);
		assertEquals(cookies.get('coo-1'), 'val <1>');
	}
);

Deno.test
(	'Cookies: entries',
	() =>
	{	const cookies = new SuperCookies('coo-1= val <1> ; coo-2=val <2>.');
		cookies.set('coo-3', 'val <3>', {maxAge: 30});
		cookies.set('coo-1', '');
		assertEquals([...cookies.keys()], ['coo-1', 'coo-2', 'coo-3']);
		assertEquals([...cookies.values()], ['', 'val <2>.', 'val <3>']);
		assertEquals([...cookies.entries()], Object.entries({'coo-1': '', 'coo-2': 'val <2>.', 'coo-3': 'val <3>'}));
		let all: Record<string, string> = {};
		cookies.forEach
		(	(v, k, map) =>
			{	assertEquals(map, cookies);
				all[k] = v;
			}
		);
		assertEquals(all, {'coo-1': '', 'coo-2': 'val <2>.', 'coo-3': 'val <3>'});
		all = {};
		for (const [k, v] of cookies)
		{	all[k] = v;
		}
		assertEquals(all, {'coo-1': '', 'coo-2': 'val <2>.', 'coo-3': 'val <3>'});
	}
);
