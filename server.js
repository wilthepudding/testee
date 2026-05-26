import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const TYPE_TO_LEGACY_CATEGORY = {
  Model: "6",
  Plugin: "7",
  Decal: "8",
  Image: "8",
  Audio: "9",
  Mesh: "10",
  Video: "14",
  FontFamily: ""
};

const TYPE_TO_NUMERIC = {
  Image: "1",
  Audio: "3",
  Mesh: "4",
  Model: "10",
  Decal: "13",
  Plugin: "38",
  Video: "62",
  FontFamily: "73"
};

const SORT_TO_LEGACY = {
  Relevance: "0",
  MostTaken: "1",
  RecentlyUpdated: "3"
};

function cleanLimit(value) {
  const n = Number(value || 24);
  if (!Number.isFinite(n)) return 24;
  return Math.max(1, Math.min(60, n));
}

function addParams(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildUrls({ keyword, assetType, sort, limit }) {
  const urls = [];
  const numericType = TYPE_TO_NUMERIC[assetType] || "";
  const legacyCategory = TYPE_TO_LEGACY_CATEGORY[assetType] || "";

  // Endpoint oficial citado pela documentação da Roblox como Toolbox / Creator Store.
  // Como a Roblox altera nomes de parâmetros com frequência, tentamos variações seguras.
  urls.push(addParams("https://apis.roblox.com/toolbox-service/v2/assets:search", {
    keyword,
    assetType,
    sort,
    limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v2/assets:search", {
    q: keyword,
    assetTypes: assetType,
    sortBy: sort,
    maxPageSize: limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v2/assets:search", {
    searchKeyword: keyword,
    assetTypes: assetType,
    sortBy: sort,
    maxPageSize: limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v2/assets:search", {
    keyword,
    assetTypes: numericType,
    sort,
    limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v2/assets:search", {
    q: keyword,
    assetTypes: numericType,
    sortBy: sort,
    maxPageSize: limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v1/marketplace/creator-store", {
    keyword,
    assetTypes: assetType,
    limit
  }));

  urls.push(addParams("https://apis.roblox.com/toolbox-service/v1/marketplace/creator-store", {
    keyword,
    assetType,
    limit
  }));

  // API legada da Library/Creator Store. Muitas vezes ainda funciona melhor para modelos e decals.
  urls.push(addParams("https://search.roblox.com/catalog/json", {
    CatalogContext: "2",
    Category: legacyCategory,
    Keyword: keyword,
    SortType: SORT_TO_LEGACY[sort] || "0",
    SortAggregation: "5",
    ResultsPerPage: limit,
    PageNumber: "1"
  }));

  // Fallback sem categoria, para quando a categoria bloqueia o resultado.
  urls.push(addParams("https://search.roblox.com/catalog/json", {
    CatalogContext: "2",
    Keyword: keyword,
    SortType: SORT_TO_LEGACY[sort] || "0",
    SortAggregation: "5",
    ResultsPerPage: limit,
    PageNumber: "1"
  }));

  return urls;
}

function getFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function getId(item) {
  return getFirst(
    item?.id,
    item?.Id,
    item?.assetId,
    item?.AssetId,
    item?.asset_id,
    item?.productId,
    item?.ProductId,
    item?.targetId,
    item?.TargetId,
    item?.creatorStoreProductId,
    item?.asset?.id,
    item?.asset?.assetId,
    item?.Asset?.Id
  );
}

function getName(item) {
  return getFirst(
    item?.name,
    item?.Name,
    item?.displayName,
    item?.DisplayName,
    item?.title,
    item?.Title,
    item?.asset?.name,
    item?.asset?.displayName
  ) || "Asset sem nome";
}

function getDescription(item) {
  return getFirst(
    item?.description,
    item?.Description,
    item?.shortDescription,
    item?.ShortDescription,
    item?.assetDescription,
    item?.AssetDescription,
    item?.asset?.description
  );
}

function getCreatorName(item) {
  const creator = item?.creator || item?.Creator || item?.creatorTarget || item?.creatorInfo || item?.asset?.creator || {};
  return getFirst(
    creator?.name,
    creator?.Name,
    creator?.displayName,
    creator?.DisplayName,
    item?.creatorName,
    item?.CreatorName,
    item?.creator,
    item?.Creator
  ) || "Criador não informado";
}

function getType(item) {
  const rawType = getFirst(
    item?.assetType,
    item?.AssetType,
    item?.type,
    item?.Type,
    item?.asset?.assetType,
    item?.assetSubTypes?.[0]
  );

  const numericToName = {
    "1": "Image",
    "3": "Audio",
    "4": "Mesh",
    "10": "Model",
    "13": "Decal",
    "38": "Plugin",
    "62": "Video",
    "73": "FontFamily"
  };

  return numericToName[String(rawType)] || rawType || "Asset";
}

function getUrl(item, id) {
  return getFirst(
    item?.url,
    item?.Url,
    item?.absoluteUrl,
    item?.AbsoluteUrl
  ) || (id ? `https://create.roblox.com/store/asset/${encodeURIComponent(id)}` : "https://create.roblox.com/store");
}

function getThumbnail(item) {
  return getFirst(
    item?.thumbnailUrl,
    item?.ThumbnailUrl,
    item?.imageUrl,
    item?.ImageUrl,
    item?.thumbnail?.url,
    item?.thumbnail?.imageUrl
  );
}

function normalizeOne(raw) {
  const item = raw?.asset || raw?.Asset || raw?.product || raw?.Product || raw;
  const id = getId(item);

  return {
    id,
    name: getName(item),
    creatorName: getCreatorName(item),
    description: getDescription(item),
    type: getType(item),
    created: getFirst(item?.created, item?.Created, item?.creationTime, item?.createdAt),
    updated: getFirst(item?.updated, item?.Updated, item?.updateTime, item?.updatedAt),
    price: getFirst(item?.price, item?.Price, item?.priceInRobux, item?.priceText, item?.PriceText) || "Grátis/Não informado",
    url: getUrl(item, id),
    thumbnailUrl: getThumbnail(item)
  };
}

function normalizeResponse(json) {
  const lists = [
    json?.assets,
    json?.Assets,
    json?.data,
    json?.Data,
    json?.results,
    json?.Results,
    json?.creatorStoreProducts,
    json?.CreatorStoreProducts,
    json?.items,
    json?.Items,
    Array.isArray(json) ? json : null
  ].filter(Boolean);

  let arr = [];
  for (const list of lists) {
    if (Array.isArray(list)) {
      arr = list;
      break;
    }
  }

  return arr
    .map(normalizeOne)
    .filter((item) => item.id || item.name)
    .slice(0, 60);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 RobloxCreatorStoreCatalog/1.1"
      },
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta não era JSON: ${text.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function addThumbnails(items) {
  const ids = items
    .map((item) => String(item.id || "").trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!ids.length) return items;

  try {
    const url = new URL("https://thumbnails.roblox.com/v1/assets");
    url.searchParams.set("assetIds", ids.join(","));
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");

    const json = await fetchJson(url.toString());
    const map = new Map();

    for (const row of json?.data || []) {
      map.set(String(row.targetId), row.imageUrl || "");
    }

    return items.map((item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl || map.get(String(item.id)) || ""
    }));
  } catch {
    return items;
  }
}

app.get("/api/search", async (req, res) => {
  const keyword = String(req.query.q || req.query.keyword || "").trim();
  const assetType = String(req.query.assetType || "").trim();
  const sort = String(req.query.sort || "Relevance").trim();
  const limit = cleanLimit(req.query.limit);

  if (!keyword) {
    return res.status(400).json({
      ok: false,
      error: "Digite uma palavra para pesquisar."
    });
  }

  const urls = buildUrls({ keyword, assetType, sort, limit });
  const errors = [];

  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      let items = normalizeResponse(json);

      if (items.length) {
        items = await addThumbnails(items);
        return res.json({
          ok: true,
          source: url,
          count: items.length,
          items
        });
      }

      errors.push(`Sem resultados: ${url}`);
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
    }
  }

  return res.status(502).json({
    ok: false,
    error: "Não consegui buscar os assets na Roblox agora.",
    details: errors.slice(0, 10)
  });
});

app.get("/api/test", async (req, res) => {
  try {
    const url = "https://search.roblox.com/catalog/json?CatalogContext=2&Keyword=sword&ResultsPerPage=5&PageNumber=1";
    const json = await fetchJson(url);
    res.json({
      ok: true,
      message: "Servidor conseguiu falar com a Roblox.",
      sampleType: Array.isArray(json) ? "array" : typeof json,
      sampleCount: Array.isArray(json) ? json.length : Object.keys(json || {}).length
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Servidor NÃO conseguiu falar com a Roblox.",
      error: error.message
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
