import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const TYPE_TO_LEGACY_CATEGORY = {
  Model: "6",
  Plugin: "7",
  Decal: "8",
  Audio: "9",
  Mesh: "10",
  Video: "14",
  Image: "8",
  FontFamily: ""
};

const SORT_TO_LEGACY = {
  Relevance: "0",
  MostTaken: "5",
  RecentlyUpdated: "3"
};

function cleanLimit(value) {
  const n = Number(value || 24);
  if (!Number.isFinite(n)) return 24;
  return Math.max(1, Math.min(60, n));
}

function buildUrls({ keyword, assetType, sort, limit }) {
  const urls = [];

  const v2 = new URL("https://apis.roblox.com/toolbox-service/v2/assets:search");
  if (keyword) v2.searchParams.set("keyword", keyword);
  if (assetType) v2.searchParams.set("assetType", assetType);
  v2.searchParams.set("sort", sort || "Relevance");
  v2.searchParams.set("limit", String(limit));
  urls.push(v2.toString());

  const v2Alt = new URL("https://apis.roblox.com/toolbox-service/v2/assets:search");
  if (keyword) v2Alt.searchParams.set("q", keyword);
  if (assetType) v2Alt.searchParams.set("assetTypes", assetType);
  v2Alt.searchParams.set("sortBy", sort || "Relevance");
  v2Alt.searchParams.set("maxPageSize", String(limit));
  urls.push(v2Alt.toString());

  const v1 = new URL("https://apis.roblox.com/toolbox-service/v1/marketplace/creator-store");
  if (keyword) v1.searchParams.set("keyword", keyword);
  if (assetType) v1.searchParams.set("assetTypes", assetType);
  v1.searchParams.set("limit", String(limit));
  urls.push(v1.toString());

  const legacy = new URL("https://search.roblox.com/catalog/json");
  legacy.searchParams.set("Keyword", keyword || "");
  legacy.searchParams.set("ResultsPerPage", String(limit));
  legacy.searchParams.set("SortType", SORT_TO_LEGACY[sort] || "0");
  legacy.searchParams.set("SortAggregation", "5");

  const category = TYPE_TO_LEGACY_CATEGORY[assetType] || "";
  if (category) legacy.searchParams.set("Category", category);
  urls.push(legacy.toString());

  return urls;
}

function getId(item) {
  return (
    item?.id ||
    item?.assetId ||
    item?.asset_id ||
    item?.productId ||
    item?.targetId ||
    item?.creatorStoreProductId ||
    item?.asset?.id ||
    item?.asset?.assetId ||
    ""
  );
}

function getName(item) {
  return (
    item?.name ||
    item?.displayName ||
    item?.title ||
    item?.asset?.name ||
    item?.asset?.displayName ||
    "Asset sem nome"
  );
}

function getCreatorName(item) {
  const creator = item?.creator || item?.creatorTarget || item?.creatorInfo || item?.asset?.creator || {};
  return (
    creator?.name ||
    creator?.displayName ||
    item?.creatorName ||
    item?.creator ||
    "Criador não informado"
  );
}

function getType(item) {
  return (
    item?.assetType ||
    item?.type ||
    item?.asset?.assetType ||
    item?.assetSubTypes?.[0] ||
    "Asset"
  );
}

function normalizeOne(raw) {
  const item = raw?.asset || raw?.product || raw;
  const id = getId(item);

  return {
    id,
    name: getName(item),
    creatorName: getCreatorName(item),
    description:
      item?.description ||
      item?.shortDescription ||
      item?.assetDescription ||
      item?.asset?.description ||
      "",
    type: getType(item),
    created: item?.created || item?.creationTime || item?.createdAt || "",
    updated: item?.updated || item?.updateTime || item?.updatedAt || "",
    price: item?.price || item?.priceInRobux || item?.priceText || "Grátis/Não informado",
    url: id
      ? `https://create.roblox.com/store/asset/${encodeURIComponent(id)}`
      : "https://create.roblox.com/store",
    thumbnailUrl: ""
  };
}

function normalizeResponse(json) {
  const lists = [
    json?.assets,
    json?.data,
    json?.results,
    json?.creatorStoreProducts,
    json?.items,
    Array.isArray(json) ? json : null
  ].filter(Boolean);

  let arr = [];
  for (const list of lists) {
    if (Array.isArray(list)) {
      arr = list;
      break;
    }
  }

  return arr.map(normalizeOne).filter((item) => item.id || item.name);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RobloxCreatorStoreCatalog/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }

    return await response.json();
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
      thumbnailUrl: map.get(String(item.id)) || ""
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
    details: errors.slice(0, 4)
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
