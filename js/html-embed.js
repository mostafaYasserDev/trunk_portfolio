const FONT_AWESOME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

export const HTML_EMBED_SANDBOX = 'allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox';
export const HTML_EMBED_RESIZE_MESSAGE = 'jidhe:html-embed-resize';

function normalizeOrigin(value) {
    try {
        const url = new URL(String(value || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
    } catch {
        return '';
    }
}

function injectIntoHead(source, injection) {
    if (/<\/head\s*>/i.test(source)) {
        return source.replace(/<\/head\s*>/i, `${injection}\n</head>`);
    }
    if (/<html(?:\s[^>]*)?>/i.test(source)) {
        return source.replace(/<html((?:\s[^>]*)?)>/i, `<html$1>\n<head>${injection}</head>`);
    }
    return `<!doctype html><html><head>${injection}</head><body>${source}</body></html>`;
}

/**
 * Keep an uploaded HTML document intact and add only the site's font,
 * Font Awesome, and a small runtime for safe external links and resizing.
 * The returned document must always be rendered inside HTML_EMBED_SANDBOX.
 */
export function prepareEmbeddedHtml(value, { origin } = {}) {
    const source = String(value || '').trim();
    if (!source) return '';

    const safeOrigin = normalizeOrigin(origin)
        || (typeof window !== 'undefined' ? normalizeOrigin(window.location.origin) : '');
    const fontRoot = safeOrigin || 'https://mostafayasser.online';

    const injection = `
<link data-jidhe-font-awesome rel="stylesheet" href="${FONT_AWESOME_URL}">
<style data-jidhe-site-font>
@font-face{font-family:'Thmanyah';src:url('${fontRoot}/otf/thmanyahseriftext-Regular.otf') format('opentype');font-weight:normal;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${fontRoot}/otf/thmanyahseriftext-Medium.otf') format('opentype');font-weight:500;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${fontRoot}/otf/thmanyahseriftext-Bold.otf') format('opentype');font-weight:bold;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${fontRoot}/otf/thmanyahseriftext-Black.otf') format('opentype');font-weight:900;font-display:swap;}
html,body,button,input,textarea,select{font-family:'Thmanyah',Tahoma,Arial,sans-serif!important;}
</style>
<script data-jidhe-embed-runtime>
(function(){
  var resizeMessage=${JSON.stringify(HTML_EMBED_RESIZE_MESSAGE)};
  var lastHeight=0;
  var resizeQueued=false;

  function normalizeLinks(root){
    var links=(root||document).querySelectorAll('a[href]');
    links.forEach(function(link){
      var href=link.getAttribute('href');
      if(!href||href.charAt(0)==='#')return;
      try{
        var url=new URL(href,document.baseURI);
        if(url.protocol==='http:'||url.protocol==='https:'){
          link.setAttribute('target','_blank');
          link.setAttribute('rel','noopener noreferrer');
        }
      }catch(e){}
    });
  }

  function reportHeight(){
    if(resizeQueued)return;
    resizeQueued=true;
    requestAnimationFrame(function(){
      resizeQueued=false;
      var body=document.body;
      var root=document.documentElement;
      var height=Math.max(
        root?root.scrollHeight:0,
        root?root.offsetHeight:0,
        body?body.scrollHeight:0,
        body?body.offsetHeight:0
      );
      if(height>0&&Math.abs(height-lastHeight)>1){
        lastHeight=height;
        parent.postMessage({type:resizeMessage,height:height},'*');
      }
    });
  }

  function init(){
    normalizeLinks(document);
    reportHeight();
    if(typeof ResizeObserver!=='undefined'){
      var observer=new ResizeObserver(reportHeight);
      if(document.documentElement)observer.observe(document.documentElement);
      if(document.body)observer.observe(document.body);
    }
    if(typeof MutationObserver!=='undefined'&&document.body){
      new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          mutation.addedNodes.forEach(function(node){
            if(node.nodeType===1){
              if(node.matches&&node.matches('a[href]'))normalizeLinks(node.parentNode||document);
              else if(node.querySelectorAll)normalizeLinks(node);
            }
          });
        });
        reportHeight();
      }).observe(document.body,{childList:true,subtree:true});
    }
    setTimeout(reportHeight,250);
    setTimeout(reportHeight,1000);
    setTimeout(reportHeight,2500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('load',reportHeight);
})();
<\/script>`;

    return injectIntoHead(source, injection);
}
