
const API_URL = "http://127.0.0.1:5000/api/products";
const PRICE_STATS_URL = "http://127.0.0.1:5000/api/price-statistics";

const PRODUCTS_UPDATED_KEY = "beautyprice_products_updated";

let allProducts = [];
let filteredProducts = [];
let snapshotAveragePrice = null;

function standardizeBrand(brand) {
    if (!brand) return "";

    return brand
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "");
}

function toNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    if (typeof value === "number") {
        return value;
    }

    let text = String(value).trim();

    if (text.includes(".") && !text.includes(",")) {
        text = text.replace(/\./g, "");
    } else if (text.includes(",") && text.includes(".")) {
        text = text
            .replace(/\./g, "")
            .replace(",", ".");
    } else if (text.includes(",")) {
        const parts = text.split(",");

        if (parts.length === 2 && parts[1].length <= 2) {
            text = parts[0] + "." + parts[1];
        } else {
            text = text.replace(/,/g, "");
        }
    }

    text = text.replace(/[^\d.-]/g, "");

    const number = Number(text);

    return Number.isFinite(number) ? number : 0;
}

function formatNumber(number) {
    return Math.round(number).toLocaleString("vi-VN");
}

function getPriceGroup(price) {
    price = toNumber(price);

    if (price < 100000) {
        return "under100";
    }

    if (price >= 100000 && price < 300000) {
        return "100to300";
    }

    if (price >= 300000 && price <= 500000) {
        return "300to500";
    }

    if (price > 500000) {
        return "over500";
    }

    return "";
}

function getDiscountGroup(discount) {
    if (
        discount === null ||
        discount === undefined ||
        discount === "" ||
        Number.isNaN(Number(discount))
    ) {
        return "discount0";
    }

    discount = toNumber(discount);

    if (discount <= 0) {
        return "discount0";
    }

    if (discount <= 10) {
        return "discount1to10";
    }

    if (discount <= 20) {
        return "discount11to20";
    }

    if (discount <= 30) {
        return "discount21to30";
    }

    return "discountOver30";
}

function updateBrandFilter(products) {
    const select = document.getElementById("brandFilter");

    if (!select) return;

    const currentValue = select.value;
    const brands = new Map();

    products.forEach(product => {
        const original = String(product.brand || "")
            .trim()
            .replace(/\s+/g, " ");

        if (!original) return;

        const key = standardizeBrand(original);

        if (!brands.has(key)) {
            brands.set(key, original);
        }
    });

    const sortedBrands = Array.from(brands.entries())
        .sort((a, b) => a[1].localeCompare(b[1], "vi"));

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Tất cả thương hiệu";
    select.appendChild(defaultOption);

    sortedBrands.forEach(([key, brand]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = brand;
        select.appendChild(option);
    });

    const exists = Array.from(select.options).some(
        option => option.value === currentValue
    );

    if (exists) {
        select.value = currentValue;
    }
}

function updateKPI(products) {
    const kpiValues = document.querySelectorAll(".kpi-value");
    const descriptions = document.querySelectorAll(".kpi-description");

    if (kpiValues.length < 4) return;

    const total = products.length;
    const brandSet = new Set();

    products.forEach(product => {
        const brand = standardizeBrand(product.brand);

        if (brand) {
            brandSet.add(brand);
        }
    });

    const prices = products
        .map(product => toNumber(product.current_price_vnd))
        .filter(price => price > 0);

    const averagePrice =
        snapshotAveragePrice !== null
            ? snapshotAveragePrice
            : prices.length > 0
                ? prices.reduce((sum, price) => sum + price, 0) / prices.length
                : 0;

    const discounted = products.filter(
        product => toNumber(product.discount_percent) > 0
    ).length;

    kpiValues[0].textContent = formatNumber(total);
    kpiValues[1].textContent = formatNumber(brandSet.size);
    kpiValues[2].textContent = formatNumber(averagePrice) + "đ";
    kpiValues[3].textContent = formatNumber(discounted);

    if (descriptions.length >= 4) {
        descriptions[0].textContent = "Tổng số sản phẩm";
        descriptions[1].textContent = "Thương hiệu trong dữ liệu";
        descriptions[2].textContent = "Giá trung bình toàn bộ dữ liệu giá";
        descriptions[3].textContent =
            "Trong tổng số " + formatNumber(total) + " sản phẩm";
    }
}

function updateTopBrands(products) {
    const container = document.querySelector(".brand-list");

    if (!container) return;

    const brandMap = new Map();

    products.forEach(product => {
        const original = String(product.brand || "")
            .trim()
            .replace(/\s+/g, " ");

        if (!original) return;

        const key = standardizeBrand(original);

        if (!brandMap.has(key)) {
            brandMap.set(key, {
                name: original,
                count: 0
            });
        }

        brandMap.get(key).count++;
    });

    const topBrands = Array.from(brandMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    container.innerHTML = "";

    if (topBrands.length === 0) {
        container.innerHTML = `
            <div class="empty-state">Không có dữ liệu</div>
        `;
        return;
    }

    const maxCount = topBrands[0].count;

    topBrands.forEach(brand => {
        const row = document.createElement("div");
        row.className = "brand-row";

        const name = document.createElement("span");
        name.textContent = brand.name;

        const bar = document.createElement("div");
        bar.className = "bar";

        const barInner = document.createElement("div");
        const percent = maxCount > 0
            ? (brand.count / maxCount) * 100
            : 0;

        barInner.style.width = percent + "%";
        bar.appendChild(barInner);

        const count = document.createElement("strong");
        count.textContent = formatNumber(brand.count);

        row.appendChild(name);
        row.appendChild(bar);
        row.appendChild(count);

        container.appendChild(row);
    });
}

function updatePriceDistribution(products) {
    const columns = document.querySelectorAll(".price-column");

    if (columns.length < 4) return;

    const counts = [0, 0, 0, 0];

    products.forEach(product => {
        const group = getPriceGroup(product.current_price_vnd);

        if (group === "under100") {
            counts[0]++;
        } else if (group === "100to300") {
            counts[1]++;
        } else if (group === "300to500") {
            counts[2]++;
        } else if (group === "over500") {
            counts[3]++;
        }
    });

    const maxCount = Math.max(...counts);

    columns.forEach((column, index) => {
        const value = column.querySelector(".column-value");
        const bar = column.querySelector(".column");

        if (value) {
            value.textContent = formatNumber(counts[index]);
        }

        if (bar) {
            if (maxCount > 0) {
                const height = (counts[index] / maxCount) * 175;
                bar.style.height = Math.max(height, 3) + "px";
            } else {
                bar.style.height = "0px";
            }
        }
    });
}

function updateDiscountDistribution(products) {
    const rows = document.querySelectorAll(".discount-list > div");

    if (rows.length < 5) return;

    const counts = [0, 0, 0, 0, 0];

    products.forEach(product => {
        const group = getDiscountGroup(product.discount_percent);

        if (group === "discount0") {
            counts[0]++;
        } else if (group === "discount1to10") {
            counts[1]++;
        } else if (group === "discount11to20") {
            counts[2]++;
        } else if (group === "discount21to30") {
            counts[3]++;
        } else if (group === "discountOver30") {
            counts[4]++;
        }
    });

    rows.forEach((row, index) => {
        const strong = row.querySelector("strong");

        if (strong) {
            strong.textContent = formatNumber(counts[index]) + " sản phẩm";
        }
    });
}

function updateInsight(products) {
    const insightItems = document.querySelectorAll(
        ".insight-list .insight"
    );

    if (insightItems.length < 3) return;

    if (products.length === 0) {
        insightItems[0].querySelector("p").textContent =
            "Không có sản phẩm phù hợp với bộ lọc hiện tại.";

        insightItems[1].querySelector("p").textContent =
            "Hãy thử thay đổi một hoặc nhiều điều kiện lọc.";

        insightItems[2].querySelector("p").textContent =
            "Chưa đủ dữ liệu để tạo insight.";

        return;
    }

    const prices = products
        .map(product => toNumber(product.current_price_vnd))
        .filter(price => price > 0);

    const averagePrice = snapshotAveragePrice !== null
        ? snapshotAveragePrice
        : prices.length > 0
            ? prices.reduce((sum, price) => sum + price, 0) / prices.length
            : 0;

    const priceGroups = [
        { name: "dưới 100.000đ", count: 0 },
        { name: "100.000đ – 300.000đ", count: 0 },
        { name: "300.000đ – 500.000đ", count: 0 },
        { name: "trên 500.000đ", count: 0 }
    ];

    prices.forEach(price => {
        const group = getPriceGroup(price);

        if (group === "under100") {
            priceGroups[0].count++;
        } else if (group === "100to300") {
            priceGroups[1].count++;
        } else if (group === "300to500") {
            priceGroups[2].count++;
        } else if (group === "over500") {
            priceGroups[3].count++;
        }
    });

    const largestPriceGroup = [...priceGroups]
        .sort((a, b) => b.count - a.count)[0];

    const pricePercentage = prices.length > 0
        ? (largestPriceGroup.count / prices.length) * 100
        : 0;

    const discounted = products.filter(
        product => toNumber(product.discount_percent) > 0
    ).length;

    const discountPercentage = products.length > 0
        ? (discounted / products.length) * 100
        : 0;

    const brandMap = new Map();

    products.forEach(product => {
        const brand = String(product.brand || "")
            .trim()
            .replace(/\s+/g, " ");

        if (!brand) return;

        const key = standardizeBrand(brand);

        if (!brandMap.has(key)) {
            brandMap.set(key, {
                name: brand,
                count: 0
            });
        }

        brandMap.get(key).count++;
    });

    const topBrand = Array.from(brandMap.values())
        .sort((a, b) => b.count - a.count)[0];

    insightItems[0].querySelector("p").textContent =
        `Phân khúc ${largestPriceGroup.name} đang chiếm tỷ trọng lớn nhất, với ${formatNumber(largestPriceGroup.count)} sản phẩm (${pricePercentage.toFixed(1)}%). Giá trung bình toàn bộ dữ liệu giá là ${formatNumber(averagePrice)}đ.`;

    insightItems[1].querySelector("p").textContent =
        `${formatNumber(discounted)} sản phẩm đang được giảm giá, chiếm ${discountPercentage.toFixed(1)}% tổng số sản phẩm trong dữ liệu hiện tại.`;

    if (topBrand) {
        const brandPercentage = products.length > 0
            ? (topBrand.count / products.length) * 100
            : 0;

        insightItems[2].querySelector("p").textContent =
            `${topBrand.name} là thương hiệu có nhiều sản phẩm nhất, với ${formatNumber(topBrand.count)} sản phẩm (${brandPercentage.toFixed(1)}% trong tập dữ liệu hiện tại).`;
    } else {
        insightItems[2].querySelector("p").textContent =
            "Chưa xác định được thương hiệu nổi bật.";
    }
}

function updateDashboard(products) {
    updateKPI(products);
    updateTopBrands(products);
    updatePriceDistribution(products);
    updateDiscountDistribution(products);
    updateInsight(products);
}

function filterProducts() {
    const brandFilter = document.getElementById("brandFilter")?.value || "";
    const priceFilter = document.getElementById("priceFilter")?.value || "";
    const discountFilter = document.getElementById("discountFilter")?.value || "";

    filteredProducts = allProducts.filter(product => {
        if (
            brandFilter &&
            standardizeBrand(product.brand) !== brandFilter
        ) {
            return false;
        }

        if (
            priceFilter &&
            getPriceGroup(product.current_price_vnd) !== priceFilter
        ) {
            return false;
        }

        if (
            discountFilter &&
            getDiscountGroup(product.discount_percent) !== discountFilter
        ) {
            return false;
        }

        return true;
    });

    updateDashboard(filteredProducts);
}

function resetFilters() {
    const brandFilter = document.getElementById("brandFilter");
    const priceFilter = document.getElementById("priceFilter");
    const discountFilter = document.getElementById("discountFilter");

    if (brandFilter) brandFilter.value = "";
    if (priceFilter) priceFilter.value = "";
    if (discountFilter) discountFilter.value = "";

    filteredProducts = [...allProducts];

    updateDashboard(filteredProducts);
}

async function loadPriceStatistics() {
    try {
        const response = await fetch(PRICE_STATS_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Không thể tải thống kê giá");
        }

        const data = await response.json();

        if (
            data.status === "success" &&
            Number.isFinite(Number(data.average_price_vnd))
        ) {
            snapshotAveragePrice = Number(data.average_price_vnd);
        } else {
            snapshotAveragePrice = null;
        }
    } catch (error) {
        console.error("Lỗi tải thống kê giá:", error);
        snapshotAveragePrice = null;
    }
}

async function loadProducts() {
    try {
        const currentBrand =
            document.getElementById("brandFilter")?.value || "";

        const currentPrice =
            document.getElementById("priceFilter")?.value || "";

        const currentDiscount =
            document.getElementById("discountFilter")?.value || "";

        const [response] = await Promise.all([
            fetch(API_URL, { cache: "no-store" }),
            loadPriceStatistics()
        ]);

        if (!response.ok) {
            throw new Error("Không thể kết nối API sản phẩm");
        }

        const data = await response.json();

        allProducts = Array.isArray(data.products)
            ? data.products
            : [];

        updateBrandFilter(allProducts);

        const brandSelect = document.getElementById("brandFilter");
        const priceSelect = document.getElementById("priceFilter");
        const discountSelect = document.getElementById("discountFilter");

        if (brandSelect) {
            const brandExists = Array.from(brandSelect.options).some(
                option => option.value === currentBrand
            );

            if (brandExists) {
                brandSelect.value = currentBrand;
            }
        }

        if (priceSelect) {
            priceSelect.value = currentPrice;
        }

        if (discountSelect) {
            discountSelect.value = currentDiscount;
        }

        filterProducts();
    } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
    }
}

function setupProductSync() {
    window.addEventListener("storage", function(event) {
        if (event.key === PRODUCTS_UPDATED_KEY) {
            loadProducts();
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const brandFilter = document.getElementById("brandFilter");
    const priceFilter = document.getElementById("priceFilter");
    const discountFilter = document.getElementById("discountFilter");
    const resetButton = document.querySelector(".reset-btn");

    if (brandFilter) {
        brandFilter.addEventListener("change", filterProducts);
    }

    if (priceFilter) {
        priceFilter.addEventListener("change", filterProducts);
    }

    if (discountFilter) {
        discountFilter.addEventListener("change", filterProducts);
    }

    if (resetButton) {
        resetButton.addEventListener("click", resetFilters);
    }

    setupProductSync();
    loadProducts();
});
