const processUrl = (url, enableCors) => {
  const corsProxyUrl = 'https://cors-anywhere.herokuapp.com';

  if (enableCors) {
    return `${corsProxyUrl}/${url}`;
  } else {
    return url;
  }
};

const getApiResponse = () => {
  return new Promise((resolve, reject) => {
    let parser = new RSSParser();
    const url = processUrl('http://feeds.bbci.co.uk/news/rss.xml', true);
    parser.parseURL(url, (err, feed) => {
      if (err) {
        reject(err);
      }

      resolve(feed.items);
    });
  });
};

const getRssData = function() {
  return {
    entries: [],
    init: async function() {
      const data = await getApiResponse();

      setInterval(await (async () => {
        const lambda = () => {
          const limit = Math.floor(Math.random() * 5) + 1;
          this.entries = data.slice(0, limit);

          // TODO: GET API RESPONSE
          // - IF FETCH FAILS, GET FROM CACHE
          // TODO: CACHE RESPONSE
          // - CLEAR EVERYTHING BEFORE RE-CACHING
        };

        lambda();

        return lambda;
      })(), 3000);
    },
  };
};

document.addEventListener('alpine:init', () => {
  Alpine.data('rss', getRssData);
});
