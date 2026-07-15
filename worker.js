import { onRequest as seoMiddleware } from './functions/_middleware.js';
import { onRequest as imageRequest } from './functions/img/[[path]].js';
import { onRequest as sitemapRequest } from './functions/sitemap.xml.js';

function assetNext(request, env) {
    return () => env.ASSETS.fetch(request);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/img/')) {
            const imagePath = url.pathname.slice('/img/'.length).split('/').filter(Boolean);
            return imageRequest({ request, env, ctx, params: { path: imagePath } });
        }

        if (url.pathname === '/sitemap.xml') {
            return sitemapRequest({ request, env, ctx, next: assetNext(request, env) });
        }

        return seoMiddleware({ request, env, ctx, next: assetNext(request, env) });
    }
};
