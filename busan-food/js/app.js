/* =========================================================
   부산 맛집 정보 서비스 App
   HTML + CSS + JavaScript
========================================================= */

/* =========================================================
   1. API 설정
   ---------------------------------------------------------
   아래 API_KEY 값만 공공데이터포털에서 발급받은
   실제 ServiceKey로 교체하면 된다.
========================================================= */

const API_CONFIG = {
  // PRD 및 부산맛집 OpenAPI 활용가이드 기준 기본 주소
  baseUrl: "https://apis.data.go.kr/6260000/FoodService",

  // [중요] 여기에 본인의 공공데이터 API 인증키를 입력한다.
  apiKey: "U3rjn1OQzoe833jk5RJokTl1sVFUmIQp7dGTZl0tcvNU7p2blLzjccSSgrAHQgyLYlBIm7Qt0wOFwQRvvG7h8Q%3D%3D",

  numOfRows: 20,

  endpoints: {
    kr: "getFoodKr",
    en: "getFoodEn",
    ja: "getFoodJa",
    zhs: "getFoodZhs",
    zht: "getFoodZht",
  },
};

/* =========================================================
   2. 앱 상태
========================================================= */

const state = {
  restaurants: [],
  allLoadedRestaurants: [],
  currentPage: 1,
  totalCount: 0,
  selectedRegion: "전체",
  searchKeyword: "",
  language: "kr",
  loading: false,
  error: null,
  favorites: loadLocalArray("busanFoodFavorites"),
  recentRestaurants: loadLocalArray("busanFoodRecent"),
  map: null,
  mapMarkers: [],
  userMarker: null,
};

/* =========================================================
   3. DOM
========================================================= */

const pages = document.querySelectorAll(".page");
const routeButtons = document.querySelectorAll("[data-route]");
const navItems = document.querySelectorAll(".nav-item");
const languageSelect = document.querySelector("#languageSelect");

const homeRestaurantGrid = document.querySelector("#homeRestaurantGrid");
const homeRegionList = document.querySelector("#homeRegionList");
const homeRecentList = document.querySelector("#homeRecentList");

const restaurantGrid = document.querySelector("#restaurantGrid");
const regionFilters = document.querySelector("#regionFilters");
const resultSummary = document.querySelector("#resultSummary");
const resetFilterBtn = document.querySelector("#resetFilterBtn");
const loadMoreBtn = document.querySelector("#loadMoreBtn");

const mapRestaurantList = document.querySelector("#mapRestaurantList");
const currentLocationBtn = document.querySelector("#currentLocationBtn");
const locationStatus = document.querySelector("#locationStatus");

const favoriteList = document.querySelector("#favoriteList");
const recentList = document.querySelector("#recentList");

const globalLoading = document.querySelector("#globalLoading");
const globalError = document.querySelector("#globalError");
const errorMessage = document.querySelector("#errorMessage");
const retryBtn = document.querySelector("#retryBtn");

const detailModal = document.querySelector("#detailModal");
const detailContent = document.querySelector("#detailContent");
const closeDetailBtn = document.querySelector("#closeDetailBtn");

const toast = document.querySelector("#toast");

/* =========================================================
   4. 앱 시작
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();

  // API Key가 입력되지 않았을 경우 샘플 데이터로 UI 전체를 확인할 수 있다.
  if (!hasRealApiKey()) {
    console.warn(
      "[부산맛집 앱] API_KEY가 아직 입력되지 않았다. 샘플 데이터로 화면을 실행한다."
    );

    state.restaurants = getSampleRestaurants();
    state.allLoadedRestaurants = [...state.restaurants];
    state.totalCount = state.restaurants.length;

    renderAll();
    showToast("API Key를 입력하면 실제 부산맛집 데이터를 불러온다.");
    return;
  }

  await fetchRestaurants({ reset: true });
});

/* =========================================================
   5. 이벤트
========================================================= */

function bindEvents() {
  // 하단 메뉴 및 라우팅 버튼
  routeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.dataset.route;
      navigate(route);
    });
  });

  // 검색 폼
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const input = form.querySelector("input[type='search']");
      state.searchKeyword = input.value.trim();

      syncSearchInputs(state.searchKeyword);
      navigate("restaurants");
      renderRestaurantList();
    });
  });

  // 언어 변경
  languageSelect.addEventListener("change", async (event) => {
    state.language = event.target.value;
    state.currentPage = 1;
    state.selectedRegion = "전체";
    state.searchKeyword = "";

    if (!hasRealApiKey()) {
      showToast("실제 API Key 입력 후 다국어 API를 호출할 수 있다.");
      return;
    }

    await fetchRestaurants({ reset: true });
  });

  // 필터 초기화
  resetFilterBtn.addEventListener("click", () => {
    state.selectedRegion = "전체";
    state.searchKeyword = "";
    syncSearchInputs("");
    renderRestaurantList();
    renderRegionFilters();
  });

  // 더보기
  loadMoreBtn.addEventListener("click", async () => {
    if (!hasRealApiKey()) {
      showToast("샘플 데이터에서는 더보기 기능을 사용하지 않는다.");
      return;
    }

    state.currentPage += 1;
    await fetchRestaurants({ reset: false });
  });

  // 재시도
  retryBtn.addEventListener("click", async () => {
    await fetchRestaurants({ reset: true });
  });

  // 상세 닫기
  closeDetailBtn.addEventListener("click", closeDetail);

  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      closeDetail();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeDetail();
    }
  });

  // 현재 위치
  currentLocationBtn.addEventListener("click", showCurrentLocation);
}

/* =========================================================
   6. API
   ---------------------------------------------------------
   수정 핵심
   1) HTTPS 우선 호출
   2) 공공데이터포털 Encoding Key 이중 인코딩 방지
   3) response.text()로 원문을 먼저 확인
   4) JSON/XML 자동 판별 및 파싱
   5) Console에 서버 원문/정규화 결과를 모두 출력
========================================================= */

function hasRealApiKey() {
  return (
    API_CONFIG.apiKey &&
    API_CONFIG.apiKey !== "YOUR_API_KEY" &&
    API_CONFIG.apiKey !== "YOUR_BUSAN_API_KEY" &&
    API_CONFIG.apiKey.trim().length > 10
  );
}

/*
  공공데이터포털은 Encoding Key와 Decoding Key를 모두 보여주는 경우가 있다.
  Encoding Key(%2F, %2B, %3D 등)를 URLSearchParams에 그대로 넣으면
  %가 %25로 다시 인코딩될 수 있다.
  따라서 한 번 decode한 값을 URLSearchParams에 전달해 이중 인코딩을 막는다.
*/
function normalizeServiceKey(key) {
  const value = String(key || "").trim();

  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn("ServiceKey 디코딩을 건너뛴다:", error);
    return value;
  }
}

function buildApiUrl(page = 1) {
  const endpoint = API_CONFIG.endpoints[state.language] || API_CONFIG.endpoints.kr;
  const serviceKey = normalizeServiceKey(API_CONFIG.apiKey);

  const params = new URLSearchParams();
  params.set("serviceKey", serviceKey);
  params.set("pageNo", String(page));
  params.set("numOfRows", String(API_CONFIG.numOfRows));
  params.set("resultType", "json");

  // 브라우저 Mixed Content 문제를 피하기 위해 HTTPS를 우선 사용한다.
  const httpsBase = API_CONFIG.baseUrl.replace(/^http:\/\//i, "https://");

  return `${httpsBase}/${endpoint}?${params.toString()}`;
}

async function fetchRestaurants({ reset = false } = {}) {
  try {
    setLoading(true);
    hideError();

    if (!hasRealApiKey()) {
      throw new Error("BUSAN API Key가 입력되지 않았다. app.js 상단의 API_CONFIG.apiKey를 확인해 주세요.");
    }

    if (reset) {
      state.currentPage = 1;
      state.restaurants = [];
      state.allLoadedRestaurants = [];
    }

    const url = buildApiUrl(state.currentPage);
    const maskedUrl = maskServiceKeyInUrl(url);

    console.group("[부산맛집 OpenAPI 요청]");
    console.log("API 요청 주소:", maskedUrl);
    console.log("요청 페이지:", state.currentPage);
    console.log("요청 언어:", state.language);
    console.log("브라우저 프로토콜:", location.protocol);

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      headers: {
        Accept: "application/json, application/xml, text/xml, */*",
      },
    });

    console.log("서버 응답 객체:", response);
    console.log("HTTP Status:", response.status);
    console.log("HTTP OK:", response.ok);
    console.log("Content-Type:", response.headers.get("content-type"));

    const rawText = await response.text();

    // PRD 핵심 요구사항: 서버에서 실제로 받은 원문을 먼저 Console에서 확인한다.
    console.log("서버 원본 응답 문자열:", rawText);

    if (!response.ok) {
      throw new Error(`HTTP 오류 ${response.status}: ${rawText.slice(0, 200)}`);
    }

    if (!rawText.trim()) {
      throw new Error("서버 응답이 비어 있다.");
    }

    const parsed = parseApiPayload(rawText, response.headers.get("content-type"));

    console.log("파싱된 서버 데이터:", parsed);

    const normalized = normalizeApiResponse(parsed);

    console.log("API 결과 코드:", normalized.resultCode);
    console.log("API 결과 메시지:", normalized.resultMsg);
    console.log("맛집 목록 데이터:", normalized.items);
    console.log("맛집 데이터 개수:", normalized.items.length);

    if (normalized.items.length > 0) {
      console.log("첫 번째 맛집 데이터:", normalized.items[0]);
      console.log("첫 번째 맛집명:", normalized.items[0].title);
      console.log("첫 번째 맛집 지역:", normalized.items[0].region);
      console.log("첫 번째 맛집 위도:", normalized.items[0].lat);
      console.log("첫 번째 맛집 경도:", normalized.items[0].lng);
      console.log("첫 번째 맛집 대표메뉴:", normalized.items[0].menu);
    }

    if (normalized.resultCode && normalized.resultCode !== "00") {
      throw new Error(
        `API 오류 ${normalized.resultCode}: ${normalized.resultMsg || "알 수 없는 오류"}`
      );
    }

    if (!normalized.items.length && Number(normalized.totalCount) > 0) {
      console.warn("totalCount는 있으나 items를 찾지 못했다. 원본 응답 구조를 확인해야 한다.");
    }

    if (reset) {
      state.restaurants = normalized.items;
    } else {
      state.restaurants = mergeById(state.restaurants, normalized.items);
    }

    state.allLoadedRestaurants = [...state.restaurants];
    state.totalCount = Number(normalized.totalCount || state.restaurants.length);

    console.log("화면 출력 예정 데이터:", state.restaurants);
    console.groupEnd();

    renderAll();
  } catch (error) {
    console.error("부산맛집 API 호출 오류:", error);

    if (console.groupEnd) {
      try { console.groupEnd(); } catch (_) {}
    }

    state.error = error;

    const detail = getFriendlyApiError(error);
    showError(detail);
  } finally {
    setLoading(false);
  }
}

function parseApiPayload(rawText, contentType = "") {
  const text = String(rawText || "").trim();
  const looksLikeJson =
    contentType?.includes("json") || text.startsWith("{") || text.startsWith("[");

  if (looksLikeJson) {
    try {
      return JSON.parse(text);
    } catch (jsonError) {
      console.warn("JSON 파싱 실패. XML 파싱을 시도한다:", jsonError);
    }
  }

  if (text.startsWith("<")) {
    return parseXmlApiResponse(text);
  }

  throw new Error(`지원하지 않는 응답 형식이다: ${text.slice(0, 120)}`);
}

function parseXmlApiResponse(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML 응답을 파싱할 수 없다.");
  }

  const getText = (selector, parent = xml) =>
    parent.querySelector(selector)?.textContent?.trim() ?? "";

  const itemNodes = [...xml.querySelectorAll("items > item, body > item, item")];

  const items = itemNodes.map((node) => {
    const obj = {};

    [...node.children].forEach((child) => {
      obj[child.tagName] = child.textContent?.trim() ?? "";
    });

    return obj;
  });

  return {
    response: {
      header: {
        resultCode: getText("header > resultCode") || getText("resultCode"),
        resultMsg: getText("header > resultMsg") || getText("resultMsg"),
      },
      body: {
        items: { item: items },
        numOfRows: getText("body > numOfRows") || getText("numOfRows"),
        pageNo: getText("body > pageNo") || getText("pageNo"),
        totalCount: getText("body > totalCount") || getText("totalCount"),
      },
    },
  };
}

function normalizeApiResponse(data) {
  const response = data?.response || data;
  const header = response?.header || data?.header || {};
  const body = response?.body || data?.body || response || {};

  let items =
    body?.items?.item ??
    body?.items ??
    data?.items?.item ??
    data?.items ??
    data?.item ??
    [];

  if (!Array.isArray(items)) {
    items = items ? [items] : [];
  }

  return {
    resultCode: String(
      header?.resultCode ??
      body?.resultCode ??
      data?.resultCode ??
      ""
    ),
    resultMsg:
      header?.resultMsg ??
      body?.resultMsg ??
      data?.resultMsg ??
      "",
    pageNo: Number(body?.pageNo ?? data?.pageNo ?? state.currentPage),
    numOfRows: Number(body?.numOfRows ?? data?.numOfRows ?? API_CONFIG.numOfRows),
    totalCount: Number(body?.totalCount ?? data?.totalCount ?? items.length),
    items: items.map(normalizeRestaurant),
  };
}

function normalizeRestaurant(item, index = 0) {
  return {
    id: String(item?.UC_SEQ ?? item?.ucSeq ?? `temp-${state.currentPage}-${index}`),
    title: cleanText(item?.MAIN_TITLE ?? item?.mainTitle ?? "이름 없음"),
    region: cleanText(item?.GUGUN_NM ?? item?.gugunNm ?? "지역 정보 없음"),
    lat: toNumber(item?.LAT ?? item?.lat),
    lng: toNumber(item?.LNG ?? item?.lng),
    place: cleanText(item?.PLACE ?? item?.place ?? ""),
    contentTitle: cleanText(item?.TITLE ?? item?.title ?? ""),
    subtitle: cleanText(item?.SUBTITLE ?? item?.subtitle ?? ""),
    address1: cleanText(item?.ADDR1 ?? item?.addr1 ?? ""),
    address2: cleanText(item?.ADDR2 ?? item?.addr2 ?? ""),
    tel: cleanText(item?.CNTCT_TEL ?? item?.cntctTel ?? ""),
    homepage: cleanText(item?.HOMEPAGE_URL ?? item?.homepageUrl ?? ""),
    usageTime: cleanText(
      item?.USAGE_DAY_WEEK_AND_TIME ?? item?.usageDayWeekAndTime ?? ""
    ),
    menu: cleanText(item?.RPRSNTV_MENU ?? item?.rprsntvMenu ?? ""),
    image: normalizeImageUrl(
      item?.MAIN_IMG_NORMAL ?? item?.mainImgNormal ?? ""
    ),
    thumb: normalizeImageUrl(
      item?.MAIN_IMG_THUMB ?? item?.mainImgThumb ?? ""
    ),
    description: cleanText(item?.ITEMCNTNTS ?? item?.itemcntnts ?? ""),
    raw: item,
  };
}

function maskServiceKeyInUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("serviceKey")) {
      parsed.searchParams.set("serviceKey", "***SERVICE_KEY***");
    }
    return parsed.toString();
  } catch (_) {
    return String(url).replace(/serviceKey=[^&]+/i, "serviceKey=***SERVICE_KEY***");
  }
}

function getFriendlyApiError(error) {
  const message = String(error?.message || error || "알 수 없는 오류");

  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return (
      "API 서버에 연결하지 못했다. Live Server로 실행했는지, 브라우저 Console의 CORS/Mixed Content 오류가 있는지, " +
      "그리고 공공데이터포털 활용신청 및 ServiceKey가 정상인지 확인해 주세요."
    );
  }

  if (/30|SERVICE_KEY|인증|키/i.test(message)) {
    return "공공데이터 ServiceKey 인증 오류다. Encoding Key 또는 Decoding Key 중 하나를 그대로 입력했는지 확인해 주세요.";
  }

  return message;
}

/* =========================================================
   7. 라우팅
========================================================= */

function navigate(route) {
  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === route);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.route === route);
  });

  if (route === "restaurants") {
    renderRestaurantList();
  }

  if (route === "map") {
    renderMapPage();
  }

  if (route === "my") {
    renderMyPage();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   8. 전체 렌더링
========================================================= */

function renderAll() {
  renderHome();
  renderRegionFilters();
  renderRestaurantList();
  renderMyPage();

  if (document.querySelector('[data-page="map"]').classList.contains("active")) {
    renderMapPage();
  }
}

/* =========================================================
   9. HOME
========================================================= */

function renderHome() {
  const homeItems = state.restaurants.slice(0, 4);

  if (!homeItems.length) {
    homeRestaurantGrid.innerHTML = emptyState(
      "맛집 데이터가 없다.",
      "API 응답을 확인해 주세요."
    );
  } else {
    homeRestaurantGrid.innerHTML = homeItems
      .map((restaurant) => restaurantCardTemplate(restaurant))
      .join("");
  }

  bindRestaurantCardEvents(homeRestaurantGrid);

  const regions = getRegions().slice(0, 12);

  homeRegionList.innerHTML = regions
    .map(
      (region) => `
        <button class="region-chip" type="button" data-home-region="${escapeHtml(region)}">
          ${escapeHtml(region)}
        </button>
      `
    )
    .join("");

  homeRegionList.querySelectorAll("[data-home-region]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRegion = button.dataset.homeRegion;
      state.searchKeyword = "";
      navigate("restaurants");
      renderRegionFilters();
      renderRestaurantList();
    });
  });

  renderMiniList(
    homeRecentList,
    getRecentRestaurantObjects().slice(0, 5),
    "아직 최근 본 맛집이 없다."
  );
}

/* =========================================================
   10. 맛집 목록 / 검색 / 지역 필터
========================================================= */

function renderRegionFilters() {
  const regions = ["전체", ...getRegions()];

  regionFilters.innerHTML = regions
    .map(
      (region) => `
        <button
          class="region-chip ${state.selectedRegion === region ? "active" : ""}"
          type="button"
          data-region="${escapeHtml(region)}"
        >
          ${escapeHtml(region)}
        </button>
      `
    )
    .join("");

  regionFilters.querySelectorAll("[data-region]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRegion = button.dataset.region;
      renderRegionFilters();
      renderRestaurantList();
    });
  });
}

function getFilteredRestaurants() {
  const keyword = state.searchKeyword.trim().toLowerCase();

  return state.restaurants.filter((restaurant) => {
    const regionMatched =
      state.selectedRegion === "전체" ||
      restaurant.region === state.selectedRegion;

    const searchableText = [
      restaurant.title,
      restaurant.region,
      restaurant.address1,
      restaurant.address2,
      restaurant.menu,
      restaurant.contentTitle,
      restaurant.subtitle,
    ]
      .join(" ")
      .toLowerCase();

    const keywordMatched = !keyword || searchableText.includes(keyword);

    return regionMatched && keywordMatched;
  });
}

function renderRestaurantList() {
  const filtered = getFilteredRestaurants();

  if (!filtered.length) {
    restaurantGrid.innerHTML = emptyState(
      "검색 결과가 없다.",
      "다른 검색어나 지역을 선택해 보세요."
    );
  } else {
    restaurantGrid.innerHTML = filtered
      .map((restaurant) => restaurantCardTemplate(restaurant))
      .join("");
  }

  bindRestaurantCardEvents(restaurantGrid);

  resultSummary.textContent =
    state.searchKeyword || state.selectedRegion !== "전체"
      ? `현재 조건에서 ${filtered.length}개의 맛집을 확인할 수 있다.`
      : `불러온 맛집 ${state.restaurants.length}개 / 전체 ${state.totalCount || state.restaurants.length}개`;

  const canLoadMore =
    hasRealApiKey() &&
    state.restaurants.length < state.totalCount &&
    state.restaurants.length > 0;

  loadMoreBtn.classList.toggle("hidden", !canLoadMore);
}

function restaurantCardTemplate(restaurant) {
  const favorite = isFavorite(restaurant.id);
  const image = restaurant.thumb || restaurant.image || fallbackImage();

  return `
    <article class="restaurant-card" data-card-id="${escapeHtml(restaurant.id)}">
      <div class="card-image-wrap">
        <img
          class="card-image"
          src="${escapeAttribute(image)}"
          alt="${escapeAttribute(restaurant.title)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${fallbackImage()}'"
        />

        <button
          class="favorite-button ${favorite ? "active" : ""}"
          type="button"
          data-favorite-id="${escapeHtml(restaurant.id)}"
          aria-label="${favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}"
          aria-pressed="${favorite}"
        >
          ${favorite ? "♥" : "♡"}
        </button>
      </div>

      <div class="card-body">
        <p class="card-region">${escapeHtml(restaurant.region)}</p>
        <h3 class="card-title">${escapeHtml(restaurant.title)}</h3>
        <p class="card-menu">${escapeHtml(restaurant.menu || restaurant.contentTitle || "대표메뉴 정보 없음")}</p>

        <div class="card-actions">
          <span class="card-address">
            ${escapeHtml(restaurant.address1 || "주소 정보 없음")}
          </span>

          <button
            class="detail-button"
            type="button"
            data-detail-id="${escapeHtml(restaurant.id)}"
          >
            상세보기
          </button>
        </div>
      </div>
    </article>
  `;
}

function bindRestaurantCardEvents(container) {
  container.querySelectorAll("[data-detail-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openDetail(button.dataset.detailId);
    });
  });

  container.querySelectorAll("[data-favorite-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.favoriteId);
    });
  });
}

/* =========================================================
   11. 상세화면
========================================================= */

function openDetail(id) {
  const restaurant = findRestaurantById(id);

  if (!restaurant) {
    showToast("맛집 정보를 찾을 수 없다.");
    return;
  }

  addRecent(restaurant);

  const favorite = isFavorite(restaurant.id);
  const image = restaurant.image || restaurant.thumb || fallbackImage();

  detailContent.innerHTML = `
    <div class="detail-hero">
      <img
        src="${escapeAttribute(image)}"
        alt="${escapeAttribute(restaurant.title)}"
        onerror="this.onerror=null;this.src='${fallbackImage()}'"
      />
    </div>

    <div class="detail-body">
      <p class="detail-region">${escapeHtml(restaurant.region)}</p>
      <h2 id="detailTitle" class="detail-title">${escapeHtml(restaurant.title)}</h2>
      <p class="detail-subtitle">
        ${escapeHtml(restaurant.contentTitle || restaurant.subtitle || "")}
      </p>

      <button
        class="secondary-button detail-favorite"
        type="button"
        data-detail-favorite="${escapeHtml(restaurant.id)}"
      >
        ${favorite ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}
      </button>

      <dl class="detail-info-grid">
        ${detailRow("대표메뉴", restaurant.menu || "정보 없음")}
        ${detailRow("운영시간", restaurant.usageTime || "정보 없음")}
        ${detailRow("주소", [restaurant.address1, restaurant.address2].filter(Boolean).join(" ") || "정보 없음")}
        ${detailRow("전화번호", restaurant.tel || "정보 없음")}
      </dl>

      <section class="detail-description">
        <h3>맛집 소개</h3>
        <p>${escapeHtml(restaurant.description || restaurant.subtitle || "상세 소개 정보가 없다.")}</p>
      </section>

      <div class="detail-cta">
        ${
          restaurant.tel
            ? `<a class="detail-link" href="tel:${escapeAttribute(restaurant.tel.replace(/\s/g, ""))}">전화하기</a>`
            : ""
        }

        ${
          restaurant.lat && restaurant.lng
            ? `<button class="detail-link secondary" type="button" data-show-map="${escapeHtml(restaurant.id)}">지도보기</button>`
            : ""
        }

        ${
          restaurant.homepage
            ? `<a class="detail-link secondary" href="${escapeAttribute(restaurant.homepage)}" target="_blank" rel="noopener noreferrer">홈페이지</a>`
            : ""
        }
      </div>
    </div>
  `;

  detailModal.classList.remove("hidden");
  detailModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const favoriteButton = detailContent.querySelector("[data-detail-favorite]");

  favoriteButton?.addEventListener("click", () => {
    toggleFavorite(restaurant.id);
    openDetail(restaurant.id);
  });

  const showMapButton = detailContent.querySelector("[data-show-map]");

  showMapButton?.addEventListener("click", () => {
    closeDetail();
    navigate("map");

    setTimeout(() => {
      focusRestaurantOnMap(restaurant.id);
    }, 150);
  });

  renderHome();
  renderMyPage();
}

function closeDetail() {
  detailModal.classList.add("hidden");
  detailModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function detailRow(label, value) {
  return `
    <div class="detail-info-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

/* =========================================================
   12. 즐겨찾기
========================================================= */

function toggleFavorite(id) {
  const restaurant = findRestaurantById(id);

  if (!restaurant) {
    return;
  }

  if (isFavorite(id)) {
    state.favorites = state.favorites.filter((item) => String(item.id) !== String(id));
    showToast("즐겨찾기에서 삭제했다.");
  } else {
    state.favorites.unshift(snapshotRestaurant(restaurant));
    state.favorites = state.favorites.slice(0, 100);
    showToast("즐겨찾기에 추가했다.");
  }

  saveLocalArray("busanFoodFavorites", state.favorites);

  renderHome();
  renderRestaurantList();
  renderMyPage();
}

function isFavorite(id) {
  return state.favorites.some((item) => String(item.id) === String(id));
}

/* =========================================================
   13. 최근 본 맛집
========================================================= */

function addRecent(restaurant) {
  state.recentRestaurants = state.recentRestaurants.filter(
    (item) => String(item.id) !== String(restaurant.id)
  );

  state.recentRestaurants.unshift(snapshotRestaurant(restaurant));
  state.recentRestaurants = state.recentRestaurants.slice(0, 20);

  saveLocalArray("busanFoodRecent", state.recentRestaurants);
}

/* =========================================================
   14. MY
========================================================= */

function renderMyPage() {
  const favoriteObjects = state.favorites
    .map((favorite) => findRestaurantById(favorite.id) || favorite)
    .filter(Boolean);

  if (!favoriteObjects.length) {
    favoriteList.innerHTML = emptyState(
      "즐겨찾기한 맛집이 없다.",
      "맛집 카드의 하트 버튼을 눌러 저장할 수 있다."
    );
  } else {
    favoriteList.innerHTML = favoriteObjects
      .map((restaurant) => restaurantCardTemplate(restaurant))
      .join("");

    bindRestaurantCardEvents(favoriteList);
  }

  renderMiniList(
    recentList,
    getRecentRestaurantObjects(),
    "최근 본 맛집이 없다."
  );
}

function getRecentRestaurantObjects() {
  return state.recentRestaurants
    .map((recent) => findRestaurantById(recent.id) || recent)
    .filter(Boolean);
}

function renderMiniList(container, restaurants, emptyMessage) {
  if (!restaurants.length) {
    container.innerHTML = emptyState(emptyMessage, "맛집 상세정보를 확인해 보세요.");
    return;
  }

  container.innerHTML = restaurants
    .map((restaurant) => {
      const image = restaurant.thumb || restaurant.image || fallbackImage();

      return `
        <article class="mini-item">
          <img
            class="mini-thumb"
            src="${escapeAttribute(image)}"
            alt="${escapeAttribute(restaurant.title)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${fallbackImage()}'"
          />

          <div class="mini-info">
            <strong>${escapeHtml(restaurant.title)}</strong>
            <span>${escapeHtml(restaurant.region || restaurant.menu || "")}</span>
          </div>

          <button
            class="mini-open"
            type="button"
            data-mini-detail="${escapeHtml(restaurant.id)}"
            aria-label="${escapeAttribute(restaurant.title)} 상세보기"
          >
            →
          </button>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-mini-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      openDetail(button.dataset.miniDetail);
    });
  });
}

/* =========================================================
   15. Kakao Map
========================================================= */

function isKakaoMapReady() {
  return Boolean(window.kakao && window.kakao.maps);
}

function renderMapPage() {
  if (!isKakaoMapReady()) {
    document.querySelector("#map").innerHTML = emptyState(
      "Kakao Map을 불러오지 못했다.",
      "index.html의 Kakao JavaScript Key와 웹 플랫폼 도메인을 확인해 주세요."
    );
    return;
  }

  initMap();
  renderMapMarkers();

  const mapRestaurants = state.restaurants
    .filter((restaurant) => Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng))
    .slice(0, 50);

  renderMiniList(
    mapRestaurantList,
    mapRestaurants.slice(0, 12),
    "좌표가 있는 맛집 데이터가 없다."
  );
}

function initMap() {
  if (state.map) {
    setTimeout(() => state.map.relayout(), 50);
    return;
  }

  const container = document.getElementById("map");
  const options = {
    center: new kakao.maps.LatLng(35.1796, 129.0756),
    level: 8,
  };

  state.map = new kakao.maps.Map(container, options);
  state.mapInfoWindows = [];
  console.log("Kakao Map 초기화 완료:", state.map);
}

function renderMapMarkers() {
  if (!state.map) return;

  state.mapMarkers.forEach((marker) => marker.setMap(null));
  state.mapMarkers = [];

  (state.mapInfoWindows || []).forEach((infoWindow) => infoWindow.close());
  state.mapInfoWindows = [];

  const validRestaurants = state.restaurants.filter(
    (restaurant) => Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng)
  );

  console.log("지도에 표시할 맛집 데이터:", validRestaurants);

  const bounds = new kakao.maps.LatLngBounds();

  validRestaurants.slice(0, 100).forEach((restaurant) => {
    // PRD 요구사항: 마커를 만들기 전에 맛집명, LAT, LNG를 Console에서 확인한다.
    console.log(
      "지도 마커 데이터:",
      restaurant.title,
      restaurant.lat,
      restaurant.lng
    );

    const position = new kakao.maps.LatLng(restaurant.lat, restaurant.lng);
    const marker = new kakao.maps.Marker({ position });
    marker.setMap(state.map);
    marker.restaurantId = restaurant.id;

    const infoWindow = new kakao.maps.InfoWindow({
      removable: true,
      content: `
        <div class="map-popup map-info">
          <strong>${escapeHtml(restaurant.title)}</strong>
          <span>${escapeHtml(restaurant.region)}</span>
          <span>${escapeHtml(restaurant.menu || "")}</span>
          <button type="button" onclick="window.openRestaurantDetail('${escapeJsString(restaurant.id)}')">
            상세보기
          </button>
        </div>
      `,
    });

    kakao.maps.event.addListener(marker, "click", () => {
      state.mapInfoWindows.forEach((item) => item.close());
      infoWindow.open(state.map, marker);
    });

    state.mapMarkers.push(marker);
    state.mapInfoWindows.push(infoWindow);
    bounds.extend(position);
  });

  if (validRestaurants.length) {
    state.map.setBounds(bounds);
    if (state.map.getLevel() < 5) {
      state.map.setLevel(5);
    }
  }
}

window.openRestaurantDetail = function (id) {
  openDetail(id);
};

function focusRestaurantOnMap(id) {
  const restaurant = findRestaurantById(id);

  if (
    !restaurant ||
    !state.map ||
    !Number.isFinite(restaurant.lat) ||
    !Number.isFinite(restaurant.lng)
  ) {
    showToast("지도 위치 정보가 없다.");
    return;
  }

  console.log(
    "선택 맛집 지도 이동:",
    restaurant.title,
    restaurant.lat,
    restaurant.lng
  );

  const position = new kakao.maps.LatLng(restaurant.lat, restaurant.lng);
  state.map.setCenter(position);
  state.map.setLevel(3);

  const markerIndex = state.mapMarkers.findIndex(
    (item) => String(item.restaurantId) === String(id)
  );

  if (markerIndex >= 0) {
    state.mapInfoWindows.forEach((item) => item.close());
    state.mapInfoWindows[markerIndex]?.open(state.map, state.mapMarkers[markerIndex]);
  }
}

function showCurrentLocation() {
  if (!navigator.geolocation) {
    locationStatus.textContent = "이 브라우저는 위치정보를 지원하지 않는다.";
    return;
  }

  if (!isKakaoMapReady()) {
    locationStatus.textContent = "Kakao Map API Key를 확인해 주세요.";
    return;
  }

  locationStatus.textContent = "현재 위치를 확인하는 중이다.";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      console.log("사용자 현재 위치:", latitude, longitude);

      if (!state.map) initMap();

      const currentPosition = new kakao.maps.LatLng(latitude, longitude);

      if (state.userMarker) {
        state.userMarker.setMap(null);
      }

      state.userMarker = new kakao.maps.Marker({ position: currentPosition });
      state.userMarker.setMap(state.map);
      state.map.setCenter(currentPosition);
      state.map.setLevel(4);

      locationStatus.textContent = "현재 위치를 지도에 표시했다.";
    },
    (error) => {
      console.error("위치정보 오류:", error);
      locationStatus.textContent =
        "위치 권한이 거부되었거나 현재 위치를 가져올 수 없다.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
}

/* =========================================================
   16. 로딩 / 오류 / Toast
========================================================= */

function setLoading(isLoading) {
  state.loading = isLoading;
  globalLoading.classList.toggle("hidden", !isLoading);
}

function showError(message) {
  errorMessage.textContent = message || "잠시 후 다시 시도해 주세요.";
  globalError.classList.remove("hidden");
}

function hideError() {
  globalError.classList.add("hidden");
}

let toastTimer = null;

function showToast(message) {
  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.remove("hidden");

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

/* =========================================================
   17. Utility
========================================================= */

function getRegions() {
  return [
    ...new Set(
      state.restaurants
        .map((restaurant) => restaurant.region)
        .filter(
          (region) =>
            region &&
            region !== "지역 정보 없음" &&
            String(region).trim() !== ""
        )
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));
}

function findRestaurantById(id) {
  return (
    state.restaurants.find((item) => String(item.id) === String(id)) ||
    state.favorites.find((item) => String(item.id) === String(id)) ||
    state.recentRestaurants.find((item) => String(item.id) === String(id)) ||
    null
  );
}

function snapshotRestaurant(restaurant) {
  return {
    id: restaurant.id,
    title: restaurant.title,
    region: restaurant.region,
    lat: restaurant.lat,
    lng: restaurant.lng,
    place: restaurant.place,
    contentTitle: restaurant.contentTitle,
    subtitle: restaurant.subtitle,
    address1: restaurant.address1,
    address2: restaurant.address2,
    tel: restaurant.tel,
    homepage: restaurant.homepage,
    usageTime: restaurant.usageTime,
    menu: restaurant.menu,
    image: restaurant.image,
    thumb: restaurant.thumb,
    description: restaurant.description,
  };
}

function mergeById(current, incoming) {
  const map = new Map();

  [...current, ...incoming].forEach((item) => {
    map.set(String(item.id), item);
  });

  return [...map.values()];
}

function syncSearchInputs(value) {
  document
    .querySelectorAll("[data-search-form] input[type='search']")
    .forEach((input) => {
      input.value = value;
    });
}

function loadLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`${key} LocalStorage 읽기 오류:`, error);
    return [];
  }
}

function saveLocalArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`${key} LocalStorage 저장 오류:`, error);
  }
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function toNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeImageUrl(url) {
  if (!url) {
    return "";
  }

  let value = String(url).trim().replace(/^>/, "");

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    // 문서 예시처럼 /uploadImgs/... 형태로 올 경우 부산시 콘텐츠 도메인 경로로 보정한다.
    // 실제 응답에서 완전한 URL이 제공되면 위 조건에서 그대로 사용한다.
    return `https://www.visitbusan.net${value}`;
  }

  return value;
}

function fallbackImage() {
  // 외부 이미지가 없어도 깨진 이미지 대신 SVG placeholder를 출력한다.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stop-color="#dff3f9"/>
          <stop offset="1" stop-color="#edf7fa"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="400" cy="205" r="54" fill="#00b4d8" opacity=".18"/>
      <text x="50%" y="54%" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#0077b6">BUSAN FOOD</text>
      <text x="50%" y="64%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#55737f">이미지 정보 없음</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function emptyState(title, description) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function escapeJsString(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

/* =========================================================
   18. API Key 입력 전 UI 확인용 샘플 데이터
   ---------------------------------------------------------
   실제 API Key를 입력하면 이 데이터는 사용되지 않는다.
   API 문서의 필드 구조와 예시 데이터를 기준으로 구성했다.
========================================================= */

function getSampleRestaurants() {
  const rows = [
    {
      UC_SEQ: "69",
      MAIN_TITLE: "로스포르쪼",
      GUGUN_NM: "강서구",
      LAT: "35.08712",
      LNG: "128.90971",
      PLACE: "로스포르쪼",
      TITLE: "계란만 사용해 반죽해 만든 생면",
      SUBTITLE: "로스포르쪼",
      ADDR1: "강서구 명지오션시티7로 29",
      CNTCT_TEL: "051-205-7406",
      USAGE_DAY_WEEK_AND_TIME: "11:00 ~ 22:00",
      RPRSNTV_MENU: "수제 생면 파스타, 로제 파스타",
      ITEMCNTNTS:
        "창밖의 풍경이 아름다운 이탈리아 요리 전문점이다. API Key 입력 전 UI 확인을 위한 샘플 데이터다.",
    },
    {
      UC_SEQ: "77",
      MAIN_TITLE: "민물가든",
      GUGUN_NM: "강서구",
      LAT: "35.160496",
      LNG: "128.89459",
      PLACE: "민물가든",
      TITLE: "건강하고 든든한 한 끼",
      ADDR1: "강서구 공항앞길85번길 13",
      CNTCT_TEL: "051-971-8428",
      USAGE_DAY_WEEK_AND_TIME: "11:00 ~ 23:30",
      RPRSNTV_MENU: "돌솥곤드레밥 정식",
      ITEMCNTNTS:
        "돌솥밥과 다양한 반찬을 함께 즐길 수 있는 맛집이다. UI 확인을 위한 샘플 데이터다.",
    },
    {
      UC_SEQ: "78",
      MAIN_TITLE: "마당집",
      GUGUN_NM: "부산진구",
      LAT: "35.15627",
      LNG: "129.05458",
      PLACE: "마당집",
      TITLE: "부드러운 육질과 전통적인 맛",
      ADDR1: "부산진구 부전로 69",
      CNTCT_TEL: "051-806-8602",
      USAGE_DAY_WEEK_AND_TIME: "11:30 ~ 22:30",
      RPRSNTV_MENU: "한우, 돌솥 한정식",
      ITEMCNTNTS:
        "고기와 돌솥밥을 함께 즐길 수 있는 맛집이다. UI 확인을 위한 샘플 데이터다.",
    },
    {
      UC_SEQ: "79",
      MAIN_TITLE: "민물집",
      GUGUN_NM: "강서구",
      LAT: "35.151657",
      LNG: "128.88205",
      PLACE: "민물집",
      TITLE: "얼큰한 민물 매운탕",
      ADDR1: "강서구 가락대로900번길 10",
      CNTCT_TEL: "051-971-7798",
      USAGE_DAY_WEEK_AND_TIME: "10:00 ~ 22:00",
      RPRSNTV_MENU: "장어구이, 민물 매운탕",
      ITEMCNTNTS:
        "얼큰한 민물 매운탕을 즐길 수 있는 맛집이다. UI 확인을 위한 샘플 데이터다.",
    },
    {
      UC_SEQ: "sample-5",
      MAIN_TITLE: "해운대 바다식당",
      GUGUN_NM: "해운대구",
      LAT: "35.1631",
      LNG: "129.1635",
      ADDR1: "해운대구 해운대해변로",
      CNTCT_TEL: "051-000-0001",
      USAGE_DAY_WEEK_AND_TIME: "10:30 ~ 21:00",
      RPRSNTV_MENU: "해산물 한상",
      ITEMCNTNTS: "샘플 UI 확인용 데이터다.",
    },
    {
      UC_SEQ: "sample-6",
      MAIN_TITLE: "광안리 한상",
      GUGUN_NM: "수영구",
      LAT: "35.1532",
      LNG: "129.1187",
      ADDR1: "수영구 광안해변로",
      CNTCT_TEL: "051-000-0002",
      USAGE_DAY_WEEK_AND_TIME: "11:00 ~ 22:00",
      RPRSNTV_MENU: "한식 정식",
      ITEMCNTNTS: "샘플 UI 확인용 데이터다.",
    },
  ];

  return rows.map((item, index) => normalizeRestaurant(item, index));
}
