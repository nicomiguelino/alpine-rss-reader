class AppCache {
  constructor({ dbName, storeName, fieldNames }) {
    this.version = 1;
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.fieldNames = [...fieldNames];
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.version);

      request.addEventListener('error', (err) => {
        console.error('Database failed to open');
        reject(err);
      });

      request.addEventListener('success', (event) => {
        console.log('Database opened successfully');
        this.db = event.target.result;
        resolve();
      });

      request.addEventListener('upgradeneeded', (event) => {
        this.db = event.target.result;
        const objectStore = this.db.createObjectStore(this.storeName, {
          keyPath: 'id',
          autoIncrement: true,
        });

        this.fieldNames.forEach((fieldName) => {
          objectStore.createIndex(fieldName, fieldName, { unique: false });
        });

        console.log('Database setup complete');
      });
    });
  }

  async addData(data) {
    const hasAllRequiredFields = this.fieldNames.every((field) => {
      return Object.keys(data).includes(field);
    });

    if (!hasAllRequiredFields) {
      throw new Error('Data does not have all required fields');
    }

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.add(data);

    return new Promise((resolve, reject) => {
      request.addEventListener('success', (event) => {
        console.log('Data added successfully');
        resolve();
      });

      request.addEventListener('error', (err) => {
        reject(err);
      });
    });
  }

  async getData() {
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.addEventListener('success', (event) => {
        resolve(event.target.result);
      });

      request.addEventListener('error', (err) => {
        reject(err);
      });
    });
  }

  async clearData() {
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.addEventListener('success', (event) => {
        resolve();
      });

      request.addEventListener('error', (err) => {
        reject(err);
      });
    });
  }
}

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
    settings: {
      limit: 7,
      cacheInterval: 3000,
    },
    loadSettings: function() {
      if (typeof screenly === 'undefined') {
        console.warn('screenly is not defined. Using default settings.');
        return;
      }

      this.settings.limit = parseInt(screenly?.settings?.limit) ||
        this.settings.limit;
      this.settings.cacheInterval = parseInt(screenly?.settings?.cache_interval) ||
        this.settings.cacheInterval;
    },
    init: async function() {
      this.loadSettings();
      const appCache = new AppCache({
        dbName: 'rssCache',
        storeName: 'rssStore',
        fieldNames: ['title', 'pubDate', 'content', 'contentSnippet'],
      });
      await appCache.openDatabase();

      setInterval(await (async () => {
        const lambda = async () => {
          try {
            const response = (await getApiResponse()).slice(0, this.settings.limit);
            await appCache.clearData();
            const entries = response.map(
              ({title, pubDate, content, contentSnippet}) => {
                return { title, pubDate, content, contentSnippet };
              }
            );

            this.entries = entries;

            entries.forEach(async (entry) => {
              await appCache.addData(entry);
            });
          } catch (err) {
            console.error(err);
            const entries = await appCache.getData();
            this.entries = entries;
          }
        };

        lambda();

        return lambda;
      })(), this.settings.cacheInterval);
    },
  };
};

document.addEventListener('alpine:init', () => {
  Alpine.data('rss', getRssData);
});
