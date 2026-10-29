const API_URL = "http://127.0.0.1:5000/api/products";
const REVIEWS_API_URL = "http://127.0.0.1:5000/api/reviews";

const ITEMS_PER_PAGE = 100;

let allProducts = [];
let filteredProducts = [];
let allReviews = [];

let currentPage = 1;
let currentRole = "USER";

let selectedProductForDetail = null;
let editingProductId = null;
let deletingProductId = null;

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
    const number = toNumber(value);
    return number === 0 ? "0đ" : number.toLocaleString("vi-VN") + "đ";
}

function formatNumber(value) {
    return toNumber(value).toLocaleString("vi-VN");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getProductId(product) {
    return String(
        product?.id ||
        product?.product_id ||
        product?._id ||
        product?.source_product_id ||
        ""
    ).trim();
}

function getAuthToken() {
    return (
        sessionStorage.getItem("beautyprice_token") ||
        sessionStorage.getItem("beautyprice_auth_token") ||
        sessionStorage.getItem("token") ||
        ""
    ).trim();
}

function getAuthHeaders(includeJson = false) {
    const headers = {};

    const token = getAuthToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

function handleAuthError(response, result = {}) {
    if (response.status === 401) {
        alert(
            result.message ||
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        );

        sessionStorage.removeItem("beautyprice_logged_in");
        sessionStorage.removeItem("beautyprice_role");
        sessionStorage.removeItem("beautyprice_token");
        sessionStorage.removeItem("beautyprice_auth_token");
        sessionStorage.removeItem("token");

        window.location.href = "login.html";
        return true;
    }

    if (response.status === 403) {
        alert(
            result.message ||
            "Bạn không có quyền thực hiện chức năng này."
        );
        return true;
    }

    return false;
}

function normalizeProductName(name) {
    if (!name) return "";

    return String(name)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function notifyProductsUpdated() {
    try {
        localStorage.setItem(
            "beautyprice_products_updated",
            Date.now().toString()
        );
    } catch (error) {
        console.warn(
            "Không thể gửi tín hiệu đồng bộ products:",
            error
        );
    }
}

function getCurrentFilterState() {
    return {
        search:
            document.getElementById("searchInput")?.value || "",
        brand:
            document.getElementById("brandFilter")?.value || "",
        source:
            document.getElementById("sourceFilter")?.value || "",
        price:
            document.getElementById("priceFilter")?.value || "",
        discount:
            document.getElementById("discountFilter")?.value || ""
    };
}

function restoreFilterState(state) {
    if (!state) return;

    const searchInput =
        document.getElementById("searchInput");

    const brandFilter =
        document.getElementById("brandFilter");

    const sourceFilter =
        document.getElementById("sourceFilter");

    const priceFilter =
        document.getElementById("priceFilter");

    const discountFilter =
        document.getElementById("discountFilter");

    if (searchInput) {
        searchInput.value = state.search || "";
    }

    if (brandFilter) {
        brandFilter.value = state.brand || "";
    }

    if (sourceFilter) {
        sourceFilter.value = state.source || "";
    }

    if (priceFilter) {
        priceFilter.value = state.price || "";
    }

    if (discountFilter) {
        discountFilter.value = state.discount || "";
    }
}

async function refreshProductsOnly(preserveFilters = true) {
    const filterState =
        preserveFilters
            ? getCurrentFilterState()
            : null;

    try {
        const response = await fetch(
            API_URL,
            {
                cache: "no-store",
                headers: getAuthHeaders()
            }
        );

        const productData =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            if (handleAuthError(response, productData)) {
                return;
            }

            throw new Error(
                productData.message ||
                "Không thể cập nhật danh sách sản phẩm."
            );
        }

        allProducts =
            Array.isArray(productData.products)
                ? productData.products
                : Array.isArray(productData)
                ? productData
                : [];

        populateBrandFilter();
        populateSourceFilter();

        if (filterState) {
            restoreFilterState(filterState);
        }

        applyFilters();
    } catch (error) {
        console.error(
            "Refresh products error:",
            error
        );
    }
}

function updateLocalProduct(
    savedProduct,
    isEditing,
    oldProductId = ""
) {
    if (!savedProduct) return false;

    const savedId =
        getProductId(savedProduct);

    if (!savedId) return false;

    if (isEditing) {
        const targetId =
            String(
                oldProductId || savedId
            ).trim();

        const index =
            allProducts.findIndex(
                product =>
                    getProductId(product) ===
                    targetId
            );

        if (index !== -1) {
            allProducts[index] =
                savedProduct;
        } else {
            allProducts.unshift(
                savedProduct
            );
        }
    } else {
        const exists =
            allProducts.some(
                product =>
                    getProductId(product) ===
                    savedId
            );

        if (!exists) {
            allProducts.unshift(
                savedProduct
            );
        }
    }

    return true;
}

function refreshProductUI(
    preserveFilters = true
) {
    const filterState =
        preserveFilters
            ? getCurrentFilterState()
            : null;

    populateBrandFilter();
    populateSourceFilter();

    if (filterState) {
        restoreFilterState(
            filterState
        );
    }

    applyFilters();
}

function normalizeBrand(brand) {
    return String(brand || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "");
}

function normalizeSource(source) {
    return String(source || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function getProductSource(product) {
    return String(
        product?.source ||
        product?.retailer_name ||
        product?.retailer ||
        product?.data_origin ||
        ""
    ).trim();
}

function getProductDiscount(product) {
    return toNumber(
        product.discount_percent
    );
}

function getReviewsForProduct(product) {
    if (
        !product ||
        !Array.isArray(allReviews)
    ) {
        return [];
    }

    const sourceText =
        String(
            product.source || ""
        ).toLowerCase();

    if (
        !sourceText.includes("hasaki") &&
        !sourceText.includes("guardian")
    ) {
        return [];
    }

    const productName =
        normalizeProductName(
            product.product_name
        );

    if (!productName) return [];

    return allReviews.filter(review => {
        const reviewName =
            normalizeProductName(
                review.product_name
            );

        if (!reviewName) return false;

        return (
            reviewName === productName ||
            reviewName.includes(productName) ||
            productName.includes(reviewName)
        );
    });
}

function getReviewStats(product) {
    const reviews =
        getReviewsForProduct(product).filter(
            review => {
                const rating =
                    toNumber(
                        review.rating
                    );

                return (
                    rating >= 1 &&
                    rating <= 5
                );
            }
        );

    const total =
        reviews.reduce(
            (sum, review) =>
                sum +
                toNumber(
                    review.rating
                ),
            0
        );

    return {
        reviews: reviews,
        count: reviews.length,
        average:
            reviews.length
                ? total /
                  reviews.length
                : 0
    };
}

function setupUser() {
    const loggedIn =
        sessionStorage.getItem(
            "beautyprice_logged_in"
        );

    const role =
        sessionStorage.getItem(
            "beautyprice_role"
        );

    if (
        loggedIn !== "true" ||
        !role
    ) {
        window.location.href =
            "login.html";

        return false;
    }

    currentRole =
        role.toLowerCase() ===
        "admin"
            ? "ADMIN"
            : "USER";

    const userAvatar =
        document.getElementById(
            "userAvatar"
        );

    const userRole =
        document.getElementById(
            "userRole"
        );

    const userRoleText =
        document.getElementById(
            "userRoleText"
        );

    const addButton =
        document.getElementById(
            "addProductBtn"
        );

    if (userAvatar) {
        userAvatar.textContent =
            currentRole === "ADMIN"
                ? "A"
                : "U";
    }

    if (userRole) {
        userRole.textContent =
            currentRole;
    }

    if (userRoleText) {
        userRoleText.textContent =
            currentRole === "ADMIN"
                ? "Quản trị viên"
                : "Người dùng";
    }

    if (
        currentRole !== "ADMIN" &&
        addButton
    ) {
        addButton.style.display =
            "none";
    }

    return true;
}

function logout() {
    const token =
        getAuthToken();

    if (token) {
        fetch(
            "http://127.0.0.1:5000/api/logout",
            {
                method: "POST",
                headers:
                    getAuthHeaders()
            }
        ).catch(() => {});
    }

    sessionStorage.removeItem(
        "beautyprice_logged_in"
    );

    sessionStorage.removeItem(
        "beautyprice_role"
    );

    sessionStorage.removeItem(
        "beautyprice_token"
    );

    sessionStorage.removeItem(
        "beautyprice_auth_token"
    );

    sessionStorage.removeItem(
        "token"
    );

    window.location.href =
        "login.html";
}

function showState(
    type,
    message = ""
) {
    const stateBox =
        document.getElementById(
            "stateBox"
        );

    const tableWrapper =
        document.getElementById(
            "tableWrapper"
        );

    if (
        !stateBox ||
        !tableWrapper
    ) {
        return;
    }

    if (type === "table") {
        stateBox.hidden = true;
        tableWrapper.hidden = false;
        return;
    }

    tableWrapper.hidden = true;
    stateBox.hidden = false;

    if (type === "loading") {
        stateBox.className =
            "state-box";

        stateBox.innerHTML =
            "Đang tải dữ liệu...";
    } else if (
        type === "empty"
    ) {
        stateBox.className =
            "state-box";

        stateBox.innerHTML =
            "Không tìm thấy sản phẩm phù hợp.";
    } else {
        stateBox.className =
            "state-box error";

        stateBox.innerHTML = `
            <div>${escapeHtml(
                message ||
                "Không thể tải dữ liệu."
            )}</div>
            <button type="button" id="retryBtn">
                Thử lại
            </button>
        `;

        document
            .getElementById(
                "retryBtn"
            )
            ?.addEventListener(
                "click",
                loadData
            );
    }
}

async function loadData() {
    showState("loading");

    try {
        const [
            productResult,
            reviewResult
        ] =
            await Promise.allSettled([
                fetch(
                    API_URL,
                    {
                        cache:
                            "no-store",
                        headers:
                            getAuthHeaders()
                    }
                ),

                fetch(
                    REVIEWS_API_URL,
                    {
                        cache:
                            "no-store",
                        headers:
                            getAuthHeaders()
                    }
                )
            ]);

        if (
            productResult.status !==
                "fulfilled" ||
            !productResult.value.ok
        ) {
            const errorData =
                productResult.status ===
                    "fulfilled"
                    ? await productResult.value
                          .json()
                          .catch(
                              () => ({})
                          )
                    : {};

            if (
                productResult.status ===
                    "fulfilled" &&
                handleAuthError(
                    productResult.value,
                    errorData
                )
            ) {
                return;
            }

            throw new Error(
                "Không thể kết nối Backend Flask."
            );
        }

        const productData =
            await productResult.value.json();

        let reviewData = {
            reviews: []
        };

        if (
            reviewResult.status ===
                "fulfilled" &&
            reviewResult.value.ok
        ) {
            reviewData =
                await reviewResult.value.json();
        }

        allProducts =
            Array.isArray(
                productData.products
            )
                ? productData.products
                : Array.isArray(
                      productData
                  )
                ? productData
                : [];

        allReviews =
            Array.isArray(
                reviewData.reviews
            )
                ? reviewData.reviews
                : Array.isArray(
                      reviewData
                  )
                ? reviewData
                : [];

        populateBrandFilter();
        populateSourceFilter();
        applyFilters();
    } catch (error) {
        console.error(error);
        showState(
            "error",
            error.message
        );
    }
}

function populateBrandFilter() {
    const select =
        document.getElementById(
            "brandFilter"
        );

    if (!select) return;

    const brands =
        new Map();

    allProducts.forEach(
        product => {
            const brand =
                String(
                    product.brand ||
                        ""
                ).trim();

            if (!brand) return;

            const key =
                normalizeBrand(
                    brand
                );

            if (!key) return;

            if (
                !brands.has(key)
            ) {
                brands.set(
                    key,
                    brand
                );
            }
        }
    );

    select.innerHTML =
        `<option value="">Tất cả thương hiệu</option>`;

    [...brands.entries()]
        .sort(
            (a, b) =>
                a[1].localeCompare(
                    b[1],
                    "vi"
                )
        )
        .forEach(
            ([
                key,
                displayName
            ]) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    key;

                option.textContent =
                    displayName;

                select.appendChild(
                    option
                );
            }
        );
}

function populateSourceFilter() {
    const select =
        document.getElementById(
            "sourceFilter"
        );

    if (!select) return;

    const sources =
        new Map();

    allProducts.forEach(
        product => {
            const source =
                getProductSource(
                    product
                );

            if (!source) return;

            const key =
                normalizeSource(
                    source
                );

            if (!key) return;

            if (
                !sources.has(key)
            ) {
                sources.set(
                    key,
                    source
                );
            }
        }
    );

    select.innerHTML =
        `<option value="">Tất cả nguồn</option>`;

    [...sources.entries()]
        .sort(
            (a, b) =>
                a[1].localeCompare(
                    b[1],
                    "vi"
                )
        )
        .forEach(
            ([
                key,
                displayName
            ]) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    key;

                option.textContent =
                    displayName;

                select.appendChild(
                    option
                );
            }
        );
}

function applyFilters() {
    const search =
        document.getElementById(
            "searchInput"
        )?.value
            .trim()
            .toLowerCase() || "";

    const brand =
        document.getElementById(
            "brandFilter"
        )?.value || "";

    const source =
        document.getElementById(
            "sourceFilter"
        )?.value || "";

    const price =
        document.getElementById(
            "priceFilter"
        )?.value || "";

    const discount =
        document.getElementById(
            "discountFilter"
        )?.value || "";

    filteredProducts =
        allProducts.filter(
            product => {
                const name =
                    String(
                        product.product_name ||
                            ""
                    ).toLowerCase();

                const productBrand =
                    String(
                        product.brand ||
                            ""
                    );

                const productSource =
                    getProductSource(
                        product
                    );

                const currentPrice =
                    toNumber(
                        product.current_price_vnd
                    );

                const productDiscount =
                    toNumber(
                        product.discount_percent
                    );

                if (
                    search &&
                    !name.includes(
                        search
                    ) &&
                    !productBrand
                        .toLowerCase()
                        .includes(
                            search
                        )
                ) {
                    return false;
                }

                if (
                    brand &&
                    normalizeBrand(
                        productBrand
                    ) !== brand
                ) {
                    return false;
                }

                if (
                    source &&
                    normalizeSource(
                        productSource
                    ) !== source
                ) {
                    return false;
                }

                if (
                    price ===
                        "under100" &&
                    currentPrice >=
                        100000
                ) {
                    return false;
                }

                if (
                    price ===
                        "100to300" &&
                    (
                        currentPrice <
                            100000 ||
                        currentPrice >=
                            300000
                    )
                ) {
                    return false;
                }

                if (
                    price ===
                        "300to500" &&
                    (
                        currentPrice <
                            300000 ||
                        currentPrice >
                            500000
                    )
                ) {
                    return false;
                }

                if (
                    price ===
                        "over500" &&
                    currentPrice <=
                        500000
                ) {
                    return false;
                }

                if (
                    discount ===
                        "0" &&
                    productDiscount >
                        0
                ) {
                    return false;
                }

                if (
                    discount ===
                        "1to10" &&
                    (
                        productDiscount <
                            1 ||
                        productDiscount >
                            10
                    )
                ) {
                    return false;
                }

                if (
                    discount ===
                        "11to20" &&
                    (
                        productDiscount <
                            11 ||
                        productDiscount >
                            20
                    )
                ) {
                    return false;
                }

                if (
                    discount ===
                        "21to30" &&
                    (
                        productDiscount <
                            21 ||
                        productDiscount >
                            30
                    )
                ) {
                    return false;
                }

                if (
                    discount ===
                        "over30" &&
                    productDiscount <=
                        30
                ) {
                    return false;
                }

                return true;
            }
        );

    currentPage = 1;

    renderTable();
    renderPagination();

    const resultCount =
        document.getElementById(
            "resultCount"
        );

    if (resultCount) {
        resultCount.textContent =
            `${formatNumber(
                filteredProducts.length
            )} sản phẩm`;
    }
}

function resetFilters() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const brandFilter =
        document.getElementById(
            "brandFilter"
        );

    const sourceFilter =
        document.getElementById(
            "sourceFilter"
        );

    const priceFilter =
        document.getElementById(
            "priceFilter"
        );

    const discountFilter =
        document.getElementById(
            "discountFilter"
        );

    if (searchInput) {
        searchInput.value = "";
    }

    if (brandFilter) {
        brandFilter.value = "";
    }

    if (sourceFilter) {
        sourceFilter.value = "";
    }

    if (priceFilter) {
        priceFilter.value = "";
    }

    if (discountFilter) {
        discountFilter.value = "";
    }

    applyFilters();
}

function iconView() {
    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
        </svg>
    `;
}

function iconEdit() {
    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
        </svg>
    `;
}

function iconDelete() {
    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v5"></path>
            <path d="M14 11v5"></path>
        </svg>
    `;
}

function renderTable() {
    const tbody =
        document.getElementById(
            "productTableBody"
        );

    if (!tbody) return;

    if (
        !filteredProducts.length
    ) {
        tbody.innerHTML = "";
        showState("empty");
        return;
    }

    showState("table");

    const start =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

    const items =
        filteredProducts.slice(
            start,
            start +
                ITEMS_PER_PAGE
        );

    tbody.innerHTML =
        items
            .map(
                (
                    product,
                    index
                ) => {
                    const productId =
                        getProductId(
                            product
                        );

                    const encodedId =
                        encodeURIComponent(
                            productId
                        );

                    const stats =
                        getReviewStats(
                            product
                        );

                    const discountVal =
                        getProductDiscount(
                            product
                        );

                    return `
                        <tr>
                            <td>${
                                start +
                                index +
                                1
                            }</td>
                            <td>
                                <div class="product-name">
                                    ${escapeHtml(
                                        product.product_name ||
                                            "Chưa có tên"
                                    )}
                                </div>
                            </td>
                            <td>${escapeHtml(
                                product.brand ||
                                    "Chưa có"
                            )}</td>
                            <td class="price">${formatCurrency(
                                product.current_price_vnd
                            )}</td>
                            <td>${
                                discountVal >
                                0
                                    ? `-${discountVal}%`
                                    : "Không"
                            }</td>
                            <td class="review-rating">${
                                stats.count
                                    ? `⭐ ${stats.average.toFixed(
                                          1
                                      )}`
                                    : "Chưa có"
                            }</td>
                            <td>${formatNumber(
                                stats.count
                            )}</td>
                            <td>
                                <div class="action-group">
                                    <button class="action-btn" type="button" data-action="view" data-id="${escapeHtml(
                                        encodedId
                                    )}" title="Xem" aria-label="Xem">
                                        ${iconView()}
                                    </button>
                                    ${
                                        currentRole ===
                                        "ADMIN"
                                            ? `
                                                <button class="action-btn" type="button" data-action="edit" data-id="${escapeHtml(
                                                    encodedId
                                                )}" title="Chỉnh sửa" aria-label="Chỉnh sửa">
                                                    ${iconEdit()}
                                                </button>
                                                <button class="action-btn" type="button" data-action="delete" data-id="${escapeHtml(
                                                    encodedId
                                                )}" title="Xóa" aria-label="Xóa">
                                                    ${iconDelete()}
                                                </button>
                                            `
                                            : ""
                                    }
                                </div>
                            </td>
                        </tr>
                    `;
                }
            )
            .join("");
}

function renderPagination() {
    const pagination =
        document.getElementById(
            "pagination"
        );

    const info =
        document.getElementById(
            "paginationInfo"
        );

    if (
        !pagination ||
        !info
    ) {
        return;
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredProducts.length /
                    ITEMS_PER_PAGE
            )
        );

    pagination.innerHTML = "";

    function addButton(
        page,
        text,
        disabled,
        active
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            `page-btn${
                active
                    ? " active"
                    : ""
            }`;

        button.textContent =
            text;

        button.disabled =
            disabled;

        if (!disabled) {
            button.addEventListener(
                "click",
                () => {
                    currentPage =
                        page;

                    renderTable();
                    renderPagination();
                }
            );
        }

        pagination.appendChild(
            button
        );
    }

    addButton(
        currentPage - 1,
        "‹",
        currentPage === 1,
        false
    );

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {
        if (
            page === 1 ||
            page === totalPages ||
            Math.abs(
                page -
                    currentPage
            ) <= 1
        ) {
            addButton(
                page,
                page,
                false,
                page ===
                    currentPage
            );
        }
    }

    addButton(
        currentPage + 1,
        "›",
        currentPage ===
            totalPages,
        false
    );

    const start =
        filteredProducts.length
            ? (currentPage - 1) *
                  ITEMS_PER_PAGE +
              1
            : 0;

    const end =
        Math.min(
            currentPage *
                ITEMS_PER_PAGE,
            filteredProducts.length
        );

    info.textContent =
        `Hiển thị ${formatNumber(
            start
        )} - ${formatNumber(
            end
        )} / ${formatNumber(
            filteredProducts.length
        )} sản phẩm (Trang ${currentPage}/${totalPages})`;
}

function openModal(id) {
    const modal =
        document.getElementById(
            id
        );

    if (!modal) return;

    modal.hidden = false;
}

function closeModal(id) {
    const modal =
        document.getElementById(
            id
        );

    if (!modal) return;

    modal.hidden = true;
}

function findProductByEncodedId(
    encodedId
) {
    const id =
        decodeURIComponent(
            encodedId || ""
        );

    return allProducts.find(
        product =>
            getProductId(
                product
            ) === id
    );
}

function viewProduct(encodedId) {
    const product =
        findProductByEncodedId(
            encodedId
        );

    if (!product) {
        alert(
            "Không tìm thấy sản phẩm trong dữ liệu hiện tại."
        );

        return;
    }

    selectedProductForDetail =
        product;

    renderDetail(product);
    openModal(
        "detailModal"
    );
}

function renderDetail(
    product
) {
    const stats =
        getReviewStats(
            product
        );

    const detail =
        document.getElementById(
            "detailContent"
        );

    if (!detail) return;

    const listedPrice =
        toNumber(
            product.listed_price_vnd
        );

    const currentPrice =
        toNumber(
            product.current_price_vnd
        );

    const discount =
        getProductDiscount(
            product
        );

    const source =
        getProductSource(
            product
        );

    detail.innerHTML = `
        <div class="detail-item product-title">
            <span>Tên sản phẩm</span>
            <strong>${escapeHtml(
                product.product_name ||
                    "Chưa có"
            )}</strong>
        </div>

        <div class="detail-item">
            <span>Thương hiệu</span>
            <strong>${escapeHtml(
                product.brand ||
                    "Chưa có"
            )}</strong>
        </div>

        <div class="detail-item">
            <span>Nguồn</span>
            <strong class="source-name">${escapeHtml(
                source ||
                    "Chưa xác định"
            )}</strong>
        </div>

        <div class="detail-item">
            <span>Giá hiện tại</span>
            <strong class="detail-current-price">${formatCurrency(
                currentPrice
            )}</strong>
        </div>

        <div class="detail-item">
            <span>Giá niêm yết</span>
            ${
                listedPrice > 0
                    ? `<strong class="detail-listed-price">${formatCurrency(
                          listedPrice
                      )}</strong>`
                    : `<strong>Chưa có</strong>`
            }
        </div>

        <div class="detail-item">
            <span>Mức giảm giá</span>
            ${
                discount > 0
                    ? `<strong class="discount-badge">-${discount}%</strong>`
                    : `<strong>Không giảm</strong>`
            }
        </div>

        <div class="detail-item full">
            <span>Trang sản phẩm</span>
            ${
                product.product_url
                    ? `<a class="product-url-btn" href="${escapeHtml(
                          product.product_url
                      )}" target="_blank" rel="noopener noreferrer">Truy cập trang sản phẩm ↗</a>`
                    : `<strong>Chưa có liên kết</strong>`
            }
        </div>
    `;

    const badge =
        document.getElementById(
            "reviewCountBadge"
        );

    if (badge) {
        badge.textContent =
            formatNumber(
                stats.count
            );
    }

    renderReviewSummary(
        stats.reviews,
        stats.average,
        stats.count
    );

    renderReviewList();
}

function renderReviewSummary(
    reviews,
    average,
    total
) {
    const container =
        document.getElementById(
            "reviewSummary"
        );

    if (!container) return;

    if (!total) {
        container.innerHTML =
            `<div class="no-review">Chưa có dữ liệu review khớp với sản phẩm này.</div>`;

        return;
    }

    const counts = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
    };

    reviews.forEach(
        review => {
            const star =
                toNumber(
                    review.rating
                );

            if (
                counts[star] !==
                undefined
            ) {
                counts[star]++;
            }
        }
    );

    const rows =
        [5, 4, 3, 2, 1]
            .map(
                star => {
                    const count =
                        counts[
                            star
                        ];

                    const percent =
                        (count /
                            total) *
                        100;

                    return `
                        <div class="review-bar-row">
                            <span>${star} sao</span>
                            <div class="review-bar">
                                <div style="width:${percent}%;"></div>
                            </div>
                            <span>${formatNumber(
                                count
                            )}</span>
                        </div>
                    `;
                }
            )
            .join("");

    container.innerHTML = `
        <div class="review-summary-inner">
            <div class="review-average">
                <div class="review-average-number">${average.toFixed(
                    1
                )}</div>
                <div class="review-average-stars">${"★".repeat(
                    Math.round(
                        average
                    )
                )}</div>
                <div class="review-average-label">${formatNumber(
                    total
                )} đánh giá</div>
            </div>

            <div class="review-bars">
                ${rows}
            </div>
        </div>
    `;
}

function renderReviewList() {
    if (
        !selectedProductForDetail
    ) {
        return;
    }

    const stats =
        getReviewStats(
            selectedProductForDetail
        );

    let reviews =
        [...stats.reviews];

    const ratingFilter =
        document.getElementById(
            "reviewRatingFilter"
        )?.value || "";

    const sortOrder =
        document.getElementById(
            "reviewSort"
        )?.value ||
        "newest";

    if (ratingFilter) {
        reviews =
            reviews.filter(
                review =>
                    toNumber(
                        review.rating
                    ) ===
                    Number(
                        ratingFilter
                    )
            );
    }

    reviews.sort(
        (a, b) => {
            const dateA =
                new Date(
                    a.review_date ||
                        0
                ).getTime();

            const dateB =
                new Date(
                    b.review_date ||
                        0
                ).getTime();

            return sortOrder ===
                "oldest"
                ? dateA - dateB
                : dateB - dateA;
        }
    );

    const container =
        document.getElementById(
            "detailReviews"
        );

    const badge =
        document.getElementById(
            "reviewCountBadge"
        );

    if (badge) {
        badge.textContent =
            formatNumber(
                stats.count
            );
    }

    if (!container) return;

    if (!reviews.length) {
        container.innerHTML =
            `<div class="no-review">Không có review phù hợp với bộ lọc.</div>`;

        return;
    }

    container.innerHTML =
        reviews
            .map(
                review => {
                    const rating =
                        toNumber(
                            review.rating
                        );

                    const author =
                        review.author ||
                        "Khách hàng";

                    const date =
                        review.review_date ||
                        "";

                    const comment =
                        review.review_text ||
                        "Không có nội dung";

                    return `
                        <div class="review-card">
                            <div class="review-card-top">
                                <span class="review-card-user">${escapeHtml(
                                    author
                                )}</span>
                                <span class="review-card-date">${escapeHtml(
                                    date
                                )}</span>
                            </div>

                            <div class="review-card-rating">
                                ${
                                    rating >
                                    0
                                        ? "★".repeat(
                                              rating
                                          )
                                        : "Chưa đánh giá"
                                }
                                ${
                                    rating >
                                    0
                                        ? ` ${rating}/5`
                                        : ""
                                }
                            </div>

                            <div class="review-card-text">
                                ${escapeHtml(
                                    comment
                                )}
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}

function openAddModal() {
    if (
        currentRole !==
        "ADMIN"
    ) {
        alert(
            "Chỉ tài khoản ADMIN mới có quyền thêm sản phẩm."
        );

        return;
    }

    editingProductId =
        null;

    const form =
        document.getElementById(
            "productForm"
        );

    if (form) {
        form.reset();
    }

    document.getElementById(
        "productModalTitle"
    ).textContent =
        "Thêm sản phẩm";

    document.getElementById(
        "productSource"
    ).value =
        "Hasaki";

    openModal(
        "productModal"
    );
}

function editProduct(
    encodedId
) {
    if (
        currentRole !==
        "ADMIN"
    ) {
        alert(
            "Tài khoản USER không có quyền chỉnh sửa."
        );

        return;
    }

    const product =
        findProductByEncodedId(
            encodedId
        );

    if (!product) {
        alert(
            "Không tìm thấy sản phẩm cần chỉnh sửa."
        );

        return;
    }

    editingProductId =
        getProductId(
            product
        );

    document.getElementById(
        "productModalTitle"
    ).textContent =
        "Chỉnh sửa sản phẩm";

    document.getElementById(
        "productBrand"
    ).value =
        product.brand ||
        "";

    document.getElementById(
        "productName"
    ).value =
        product.product_name ||
        "";

    document.getElementById(
        "productListedPrice"
    ).value =
        toNumber(
            product.listed_price_vnd
        );

    document.getElementById(
        "productDiscount"
    ).value =
        getProductDiscount(
            product
        );

    document.getElementById(
        "productPrice"
    ).value =
        toNumber(
            product.current_price_vnd
        );

    document.getElementById(
        "productSource"
    ).value =
        product.source ||
        "";

    openModal(
        "productModal"
    );
}

async function saveProduct(
    event
) {
    event.preventDefault();

    if (
        currentRole !==
        "ADMIN"
    ) {
        alert(
            "Bạn không có quyền thực hiện thao tác này."
        );

        return;
    }

    const token =
        getAuthToken();

    if (!token) {
        alert(
            "Không tìm thấy phiên đăng nhập Admin. Vui lòng đăng nhập lại."
        );

        window.location.href =
            "login.html";

        return;
    }

    const form =
        document.getElementById(
            "productForm"
        );

    const submitButton =
        event.submitter ||
        form?.querySelector(
            'button[type="submit"]'
        );

    const productData = {
        product_name:
            document.getElementById(
                "productName"
            ).value.trim(),

        brand:
            document.getElementById(
                "productBrand"
            ).value.trim(),

        listed_price_vnd:
            toNumber(
                document.getElementById(
                    "productListedPrice"
                ).value
            ),

        discount_percent:
            toNumber(
                document.getElementById(
                    "productDiscount"
                ).value
            ),

        current_price_vnd:
            toNumber(
                document.getElementById(
                    "productPrice"
                ).value
            ),

        source:
            document.getElementById(
                "productSource"
            ).value.trim()
    };

    const targetProductId =
        editingProductId;

    const isEditing =
        Boolean(
            targetProductId
        );

    const url =
        isEditing
            ? `${API_URL}/${encodeURIComponent(
                  targetProductId
              )}`
            : API_URL;

    try {
        if (submitButton) {
            submitButton.disabled =
                true;

            submitButton.dataset.oldText =
                submitButton.textContent;

            submitButton.textContent =
                isEditing
                    ? "Đang lưu..."
                    : "Đang thêm...";
        }

        const response =
            await fetch(
                url,
                {
                    method:
                        isEditing
                            ? "PUT"
                            : "POST",

                    headers:
                        getAuthHeaders(
                            true
                        ),

                    body:
                        JSON.stringify(
                            productData
                        )
                }
            );

        const result =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            if (
                handleAuthError(
                    response,
                    result
                )
            ) {
                return;
            }

            throw new Error(
                result.message ||
                "Lưu dữ liệu thất bại."
            );
        }

        const savedProduct =
            result?.product ||
            null;

        closeModal(
            "productModal"
        );

        if (savedProduct) {
            const updated =
                updateLocalProduct(
                    savedProduct,
                    isEditing,
                    targetProductId
                );

            if (updated) {
                refreshProductUI(
                    true
                );
            } else {
                await refreshProductsOnly(
                    true
                );
            }
        } else {
            await refreshProductsOnly(
                true
            );
        }

        editingProductId =
            null;

        notifyProductsUpdated();

        alert(
            isEditing
                ? "Đã cập nhật sản phẩm thành công!"
                : "Đã thêm sản phẩm mới thành công!"
        );
    } catch (error) {
        console.error(
            error
        );

        alert(
            error.message
        );
    } finally {
        if (submitButton) {
            submitButton.disabled =
                false;

            submitButton.textContent =
                submitButton.dataset.oldText ||
                (
                    isEditing
                        ? "Lưu"
                        : "Thêm"
                );
        }
    }
}

function deleteProduct(
    encodedId
) {
    if (
        currentRole !==
        "ADMIN"
    ) {
        alert(
            "Tài khoản USER không có quyền xóa dữ liệu."
        );

        return;
    }

    const product =
        findProductByEncodedId(
            encodedId
        );

    if (!product) {
        alert(
            "Không tìm thấy sản phẩm cần xóa."
        );

        return;
    }

    deletingProductId =
        getProductId(
            product
        );

    document.getElementById(
        "deleteMessage"
    ).textContent =
        `Bạn có chắc chắn muốn xóa sản phẩm “${
            product.product_name ||
            "Chưa có tên"
        }” không?`;

    openModal(
        "deleteModal"
    );
}

async function confirmDelete() {
    if (
        !deletingProductId ||
        currentRole !==
            "ADMIN"
    ) {
        return;
    }

    const token =
        getAuthToken();

    if (!token) {
        alert(
            "Không tìm thấy phiên đăng nhập Admin. Vui lòng đăng nhập lại."
        );

        window.location.href =
            "login.html";

        return;
    }

    const productIdToDelete =
        deletingProductId;

    const confirmButton =
        document.getElementById(
            "confirmDeleteBtn"
        );

    try {
        if (confirmButton) {
            confirmButton.disabled =
                true;

            confirmButton.dataset.oldText =
                confirmButton.textContent;

            confirmButton.textContent =
                "Đang xóa...";
        }

        const response =
            await fetch(
                `${API_URL}/${encodeURIComponent(
                    productIdToDelete
                )}`,
                {
                    method:
                        "DELETE",

                    headers:
                        getAuthHeaders()
                }
            );

        const result =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            if (
                handleAuthError(
                    response,
                    result
                )
            ) {
                return;
            }

            throw new Error(
                result.message ||
                "Xóa dữ liệu thất bại."
            );
        }

        closeModal(
            "deleteModal"
        );

        allProducts =
            allProducts.filter(
                product =>
                    getProductId(
                        product
                    ) !==
                    productIdToDelete
            );

        refreshProductUI(
            true
        );

        deletingProductId =
            null;

        notifyProductsUpdated();

        alert(
            "Đã xóa sản phẩm thành công!"
        );
    } catch (error) {
        console.error(
            error
        );

        alert(
            error.message
        );
    } finally {
        if (confirmButton) {
            confirmButton.disabled =
                false;

            confirmButton.textContent =
                confirmButton.dataset.oldText ||
                "Xóa";
        }
    }
}

function setupEvents() {
    document
        .getElementById(
            "searchInput"
        )
        ?.addEventListener(
            "input",
            applyFilters
        );

    document
        .getElementById(
            "brandFilter"
        )
        ?.addEventListener(
            "change",
            applyFilters
        );

    document
        .getElementById(
            "sourceFilter"
        )
        ?.addEventListener(
            "change",
            applyFilters
        );

    document
        .getElementById(
            "priceFilter"
        )
        ?.addEventListener(
            "change",
            applyFilters
        );

    document
        .getElementById(
            "discountFilter"
        )
        ?.addEventListener(
            "change",
            applyFilters
        );

    document
        .getElementById(
            "resetBtn"
        )
        ?.addEventListener(
            "click",
            resetFilters
        );

    document
        .getElementById(
            "addProductBtn"
        )
        ?.addEventListener(
            "click",
            openAddModal
        );

    document
        .getElementById(
            "confirmDeleteBtn"
        )
        ?.addEventListener(
            "click",
            confirmDelete
        );

    document
        .getElementById(
            "reviewRatingFilter"
        )
        ?.addEventListener(
            "change",
            renderReviewList
        );

    document
        .getElementById(
            "reviewSort"
        )
        ?.addEventListener(
            "change",
            renderReviewList
        );

    document
        .getElementById(
            "productForm"
        )
        ?.addEventListener(
            "submit",
            saveProduct
        );

    document
        .getElementById(
            "logoutBtn"
        )
        ?.addEventListener(
            "click",
            logout
        );

    document
        .getElementById(
            "productTableBody"
        )
        ?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "button[data-action]"
                    );

                if (!button) return;

                const action =
                    button.dataset.action;

                const id =
                    button.dataset.id ||
                    "";

                if (
                    action ===
                    "view"
                ) {
                    viewProduct(id);
                }

                if (
                    action ===
                    "edit"
                ) {
                    editProduct(id);
                }

                if (
                    action ===
                    "delete"
                ) {
                    deleteProduct(id);
                }
            }
        );

    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        closeModal(
                            button.dataset
                                .close
                        );
                    }
                );
            }
        );

    document
        .querySelectorAll(
            ".modal-overlay"
        )
        .forEach(
            overlay => {
                overlay.addEventListener(
                    "click",
                    event => {
                        if (
                            event.target ===
                            overlay
                        ) {
                            overlay.hidden =
                                true;
                        }
                    }
                );
            }
        );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            document
                .querySelectorAll(
                    ".modal-overlay:not([hidden])"
                )
                .forEach(
                    modal => {
                        modal.hidden =
                            true;
                    }
                );
        }
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key !==
                "beautyprice_products_updated"
            ) {
                return;
            }

            refreshProductsOnly(
                true
            );
        }
    );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        if (!setupUser()) {
            return;
        }

        setupEvents();

        await loadData();
    }
);