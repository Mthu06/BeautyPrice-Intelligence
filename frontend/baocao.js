const API_URL = "http://127.0.0.1:5000/api/products";
const PRICE_API_URL = "http://127.0.0.1:5000/api/price-statistics";
const REVIEW_API_URL = "http://127.0.0.1:5000/api/reviews";

let allProducts = [];
let priceStatistics = {};
let reviewData = [];

function toNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    const text = String(value)
        .replace(/,/g, "")
        .replace(/[^\d.-]/g, "");

    const number = Number(text);

    return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
    const number = toNumber(value);

    if (number === null) {
        return "-";
    }

    return new Intl.NumberFormat("vi-VN").format(
        Math.round(number)
    );
}

function formatCurrency(value) {
    const number = toNumber(value);

    if (number === null) {
        return "-";
    }

    return new Intl.NumberFormat("vi-VN").format(
        Math.round(number)
    ) + " đ";
}

function formatPercent(value) {
    const number = toNumber(value);

    if (number === null) {
        return "-";
    }

    return Math.round(number) + "%";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeBrand(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

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

function getBrandName(product) {
    const original = String(product.brand || "")
        .trim()
        .replace(/\s+/g, " ");

    return original || "Không xác định";
}

function getBrandKey(product) {
    return standardizeBrand(product.brand);
}

function getPrice(product) {
    const price = toNumber(product.current_price_vnd);

    if (price === null || price <= 0) {
        return null;
    }

    return price;
}

function getDiscount(product) {
    const discount = toNumber(product.discount_percent);

    if (discount === null || discount < 0) {
        return 0;
    }

    return discount;
}

function getDiscountRange(discount) {
    if (discount <= 0) {
        return "0";
    }

    if (discount <= 10) {
        return "1to10";
    }

    if (discount <= 20) {
        return "11to20";
    }

    if (discount <= 30) {
        return "21to30";
    }

    return "over30";
}

function extractProducts(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.products)) {
        return response.products;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    return [];
}

function extractReviews(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.reviews)) {
        return response.reviews;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.data?.reviews)) {
        return response.data.reviews;
    }

    return [];
}

function getStatisticObject(response) {
    if (!response) {
        return {};
    }

    if (
        response.statistics &&
        typeof response.statistics === "object"
    ) {
        return response.statistics;
    }

    if (
        response.price_statistics &&
        typeof response.price_statistics === "object"
    ) {
        return response.price_statistics;
    }

    if (
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data)
    ) {
        if (response.data.statistics) {
            return response.data.statistics;
        }

        if (response.data.price_statistics) {
            return response.data.price_statistics;
        }

        return response.data;
    }

    return response;
}

function getStatValue(object, keys) {
    for (const key of keys) {
        if (
            object &&
            object[key] !== undefined &&
            object[key] !== null
        ) {
            return toNumber(object[key]);
        }
    }

    return null;
}

function isTrue(value) {
    if (value === true || value === 1) {
        return true;
    }

    const text = String(value ?? "")
        .trim()
        .toLowerCase();

    return [
        "true",
        "1",
        "yes",
        "y",
        "đã mua",
        "da mua",
        "purchased"
    ].includes(text);
}

function hasImage(value) {
    if (value === true || value === 1) {
        return true;
    }

    const text = String(value ?? "")
        .trim()
        .toLowerCase();

    return [
        "true",
        "1",
        "yes",
        "y",
        "có",
        "co"
    ].includes(text);
}

function calculateCurrentPriceStatistics() {
    const prices = allProducts
        .map(getPrice)
        .filter(value => value !== null)
        .sort((a, b) => a - b);

    if (!prices.length) {
        return {
            min: null,
            median: null,
            max: null
        };
    }

    const middle = Math.floor(prices.length / 2);

    const median =
        prices.length % 2 === 0
            ? (prices[middle - 1] + prices[middle]) / 2
            : prices[middle];

    return {
        min: prices[0],
        median: median,
        max: prices[prices.length - 1]
    };
}

function calculateStandardizedBrandCount() {
    const brands = new Set();

    allProducts.forEach(product => {
        const brand = standardizeBrand(product.brand);

        if (brand) {
            brands.add(brand);
        }
    });

    return brands.size;
}

function calculateReviewStatistics() {
    const ratings = reviewData
        .map(review => toNumber(review.rating))
        .filter(value => value !== null);

    const purchasedCount = reviewData.filter(review =>
        isTrue(
            review.purchased ??
            review.is_purchased ??
            review.purchased_status ??
            review.verified_purchase
        )
    ).length;

    const imageCount = reviewData.filter(review =>
        hasImage(
            review.has_image ??
            review.image ??
            review.images ??
            review.has_images
        )
    ).length;

    const averageRating = ratings.length
        ? ratings.reduce((sum, value) => sum + value, 0) /
          ratings.length
        : null;

    return {
        total: reviewData.length,
        averageRating: averageRating,
        purchasedRate: reviewData.length
            ? (purchasedCount / reviewData.length) * 100
            : null,
        imageRate: reviewData.length
            ? (imageCount / reviewData.length) * 100
            : null
    };
}

function getStage6AveragePrice() {
    return getStatValue(
        priceStatistics,
        [
            "mean",
            "average",
            "avg",
            "average_price"
        ]
    );
}

function getStage6MinPrice() {
    return getStatValue(
        priceStatistics,
        [
            "min",
            "min_price",
            "minimum"
        ]
    );
}

function getStage6MedianPrice() {
    return getStatValue(
        priceStatistics,
        [
            "median",
            "median_price",
            "p50"
        ]
    );
}

function getStage6MaxPrice() {
    return getStatValue(
        priceStatistics,
        [
            "max",
            "max_price",
            "maximum"
        ]
    );
}

function renderKPI() {
    const totalProducts = allProducts.length;

    const totalBrands = calculateStandardizedBrandCount();

    const stage6AveragePrice =
        getStage6AveragePrice();

    const discountedProducts = allProducts.filter(
        product => getDiscount(product) > 0
    ).length;

    document.getElementById("totalProducts").textContent =
        formatNumber(totalProducts);

    document.getElementById("totalBrands").textContent =
        formatNumber(totalBrands);

    document.getElementById("averagePrice").textContent =
        formatCurrency(stage6AveragePrice);

    document.getElementById("discountedProducts").textContent =
        formatNumber(discountedProducts);
}

function renderOverview() {
    const fallback =
        calculateCurrentPriceStatistics();

    const minPrice =
        getStage6MinPrice() ??
        fallback.min;

    const medianPrice =
        getStage6MedianPrice() ??
        fallback.median;

    const maxPrice =
        getStage6MaxPrice() ??
        fallback.max;

    const discounts = allProducts
        .map(product =>
            toNumber(product.discount_percent)
        )
        .filter(
            value =>
                value !== null &&
                value >= 0
        );

    const averageDiscount = discounts.length
        ? discounts.reduce(
            (sum, value) => sum + value,
            0
        ) / discounts.length
        : null;

    document.getElementById("minPrice").textContent =
        formatCurrency(minPrice);

    document.getElementById("medianPrice").textContent =
        formatCurrency(medianPrice);

    document.getElementById("maxPrice").textContent =
        formatCurrency(maxPrice);

    document.getElementById("averageDiscount").textContent =
        formatPercent(averageDiscount);
}

function renderPriceReport() {
    const ranges = [
        {
            label: "Dưới 100K",
            min: 0,
            max: 100000
        },
        {
            label: "100K – 300K",
            min: 100000,
            max: 300000
        },
        {
            label: "300K – 500K",
            min: 300000,
            max: 500000
        },
        {
            label: "500K – 1M",
            min: 500000,
            max: 1000000
        },
        {
            label: "Trên 1M",
            min: 1000000,
            max: Infinity
        }
    ];

    const prices = allProducts
        .map(getPrice)
        .filter(value => value !== null);

    const total = prices.length;

    const html = ranges.map(range => {
        const count = prices.filter(price => {
            if (range.max === Infinity) {
                return price >= range.min;
            }

            return (
                price >= range.min &&
                price < range.max
            );
        }).length;

        const percentage = total
            ? (count / total) * 100
            : 0;

        return `
            <div class="price-item">
                <span>${escapeHtml(range.label)}</span>
                <strong>${formatNumber(count)}</strong>
                <small>${Math.round(percentage)}% sản phẩm</small>
            </div>
        `;
    }).join("");

    document.getElementById("priceReport").innerHTML =
        html;
}

function renderDiscountReport() {
    const ranges = [
        {
            key: "0",
            label: "Không giảm"
        },
        {
            key: "1to10",
            label: "1% – 10%"
        },
        {
            key: "11to20",
            label: "11% – 20%"
        },
        {
            key: "21to30",
            label: "21% – 30%"
        },
        {
            key: "over30",
            label: "Trên 30%"
        }
    ];

    const total = allProducts.length;

    const html = ranges.map(range => {
        const count = allProducts.filter(
            product =>
                getDiscountRange(
                    getDiscount(product)
                ) === range.key
        ).length;

        const percentage = total
            ? (count / total) * 100
            : 0;

        return `
            <div class="discount-row">
                <span class="discount-label">
                    ${escapeHtml(range.label)}
                </span>

                <div class="discount-bar">
                    <div
                        class="discount-fill"
                        style="width:${Math.min(
                            percentage,
                            100
                        )}%"
                    ></div>
                </div>

                <span class="discount-value">
                    ${formatNumber(count)} · ${Math.round(percentage)}%
                </span>
            </div>
        `;
    }).join("");

    document.getElementById("discountReport").innerHTML =
        html;
}

function renderBrandReport() {
    const brandMap = new Map();

    allProducts.forEach(product => {
        const brandName = getBrandName(product);
        const brandKey = getBrandKey(product);

        if (!brandKey) {
            return;
        }

        if (!brandMap.has(brandKey)) {
            brandMap.set(brandKey, {
                name: brandName,
                count: 0,
                prices: [],
                discounts: []
            });
        }

        const item = brandMap.get(brandKey);

        item.count += 1;

        const price = getPrice(product);

        if (price !== null) {
            item.prices.push(price);
        }

        const discount =
            toNumber(product.discount_percent);

        if (
            discount !== null &&
            discount >= 0
        ) {
            item.discounts.push(discount);
        }
    });

    const brands = Array.from(
        brandMap.values()
    )
        .sort(
            (a, b) =>
                b.count - a.count
        )
        .slice(0, 10);

    const total = allProducts.length;

    const html = brands.map(
        (brand, index) => {
            const averagePrice =
                brand.prices.length
                    ? brand.prices.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / brand.prices.length
                    : null;

            const averageDiscount =
                brand.discounts.length
                    ? brand.discounts.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / brand.discounts.length
                    : null;

            const share = total
                ? (brand.count / total) * 100
                : 0;

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(brand.name)}</td>
                    <td>${formatNumber(brand.count)}</td>
                    <td>${Math.round(share)}%</td>
                    <td>
                        ${
                            averagePrice === null
                                ? "-"
                                : new Intl.NumberFormat("vi-VN").format(
                                    Math.round(averagePrice)
                                ) + " đ"
                        }
                    </td>
                    <td>
                        ${
                            averageDiscount === null
                                ? "-"
                                : Math.round(averageDiscount) + "%"
                        }
                    </td>
                </tr>
            `;
        }
    ).join("");

    document.getElementById(
        "brandReportBody"
    ).innerHTML =
        html ||
        `
            <tr>
                <td colspan="6">
                    Không có dữ liệu
                </td>
            </tr>
        `;
}

function renderReviews(response) {
    const summary =
        response?.summary ||
        response?.data?.summary ||
        {};

    const calculated =
        calculateReviewStatistics();

    const total =
        getStatValue(
            summary,
            [
                "total",
                "total_reviews",
                "count"
            ]
        ) ??
        getStatValue(
            response,
            [
                "total",
                "total_reviews",
                "count"
            ]
        ) ??
        calculated.total;

    const averageRating =
        getStatValue(
            summary,
            [
                "average_rating",
                "avg_rating",
                "mean_rating"
            ]
        ) ??
        getStatValue(
            response,
            [
                "average_rating",
                "avg_rating",
                "mean_rating"
            ]
        ) ??
        calculated.averageRating;

    const purchasedRate =
        getStatValue(
            summary,
            [
                "purchased_rate",
                "purchase_rate",
                "purchased_percent"
            ]
        ) ??
        calculated.purchasedRate;

    const imageRate =
        getStatValue(
            summary,
            [
                "images_rate",
                "image_rate",
                "image_percent"
            ]
        ) ??
        calculated.imageRate;

    document.getElementById(
        "totalReviews"
    ).textContent =
        formatNumber(total);

    document.getElementById(
        "averageRating"
    ).textContent =
        averageRating === null
            ? "-"
            : Number(averageRating).toFixed(2) +
              " ★";

    document.getElementById(
        "purchasedRate"
    ).textContent =
        purchasedRate === null
            ? "-"
            : formatPercent(purchasedRate);

    document.getElementById(
        "imageRate"
    ).textContent =
        imageRate === null
            ? "-"
            : formatPercent(imageRate);
}

function renderInsight() {
    const totalProducts =
        allProducts.length;

    const totalBrands =
        calculateStandardizedBrandCount();

    const discountedProducts =
        allProducts.filter(
            product =>
                getDiscount(product) > 0
        ).length;

    const discountedRate =
        totalProducts
            ? (
                discountedProducts /
                totalProducts
            ) * 100
            : 0;

    const brands = new Map();

    allProducts.forEach(product => {
        const brandName = getBrandName(product);
        const brandKey = getBrandKey(product);

        if (!brandKey) {
            return;
        }

        if (!brands.has(brandKey)) {
            brands.set(brandKey, {
                name: brandName,
                count: 0
            });
        }

        brands.get(brandKey).count += 1;
    });

    const topBrand =
        Array.from(brands.values())
            .sort(
                (a, b) =>
                    b.count - a.count
            )[0];

    const stage6Median =
        getStage6MedianPrice();

    const currentStats =
        calculateCurrentPriceStatistics();

    const median =
        stage6Median ??
        currentStats.median;

    const insights = [];

    insights.push(
        `Dữ liệu hiện tại gồm ${formatNumber(
            totalProducts
        )} sản phẩm thuộc ${formatNumber(
            totalBrands
        )} thương hiệu sau khi chuẩn hóa tên thương hiệu.`
    );

    if (topBrand) {
        insights.push(
            `${escapeHtml(
                topBrand.name
            )} là thương hiệu có nhiều sản phẩm nhất với ${formatNumber(
                topBrand.count
            )} sản phẩm.`
        );
    }

    insights.push(
        `${formatNumber(
            discountedProducts
        )} sản phẩm đang có giảm giá, tương đương ${Math.round(
            discountedRate
        )}% tổng số sản phẩm.`
    );

    if (median !== null) {
        insights.push(
            `Giá trung vị khoảng ${formatCurrency(
                median
            )}, phản ánh mức giá điển hình của sản phẩm trong dữ liệu.`
        );
    }

    document.getElementById(
        "reportInsight"
    ).innerHTML =
        insights
            .slice(0, 4)
            .map(
                text => `
                    <div class="insight-item">
                        <span class="insight-dot"></span>
                        <p>${text}</p>
                    </div>
                `
            )
            .join("");
}

async function loadProducts() {
    const response =
        await fetch(API_URL, {
            cache: "no-store"
        });

    if (!response.ok) {
        throw new Error(
            "Không thể tải dữ liệu sản phẩm."
        );
    }

    const data =
        await response.json();

    allProducts =
        extractProducts(data);
}

async function loadPriceStatistics() {
    try {
        const response =
            await fetch(
                PRICE_API_URL,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            priceStatistics = {};
            return;
        }

        const data =
            await response.json();

        priceStatistics =
            getStatisticObject(data);
    } catch (error) {
        priceStatistics = {};
    }
}

async function loadReviews() {
    try {
        const response =
            await fetch(
                REVIEW_API_URL,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            reviewData = [];
            renderReviews({});
            return;
        }

        const data =
            await response.json();

        reviewData =
            extractReviews(data);

        renderReviews(data);
    } catch (error) {
        reviewData = [];
        renderReviews({});
    }
}

async function loadReport() {
    try {
        await Promise.all([
            loadProducts(),
            loadPriceStatistics(),
            loadReviews()
        ]);

        renderKPI();
        renderOverview();
        renderPriceReport();
        renderDiscountReport();
        renderBrandReport();
        renderInsight();

        document.getElementById(
            "reportDate"
        ).textContent =
            "Cập nhật: " +
            new Date().toLocaleDateString(
                "vi-VN"
            );
    } catch (error) {
        console.error(error);

        document.getElementById(
            "reportInsight"
        ).innerHTML = `
            <div class="insight-item">
                <span class="insight-dot"></span>
                <p>
                    Không thể tải dữ liệu báo cáo.
                    Vui lòng kiểm tra backend và thử lại.
                </p>
            </div>
        `;
    }
}

function printReport() {
    window.print();
}

function csvEscape(value) {
    const text =
        String(value ?? "");

    return `"${text.replace(
        /"/g,
        '""'
    )}"`;
}

function exportCSV() {
    const rows = [];

    rows.push([
        "BÁO CÁO BEAUTYPRICE INTELLIGENCE"
    ]);

    rows.push([]);

    rows.push([
        "Chỉ số",
        "Giá trị"
    ]);

    rows.push([
        "Tổng sản phẩm",
        allProducts.length
    ]);

    rows.push([
        "Thương hiệu",
        calculateStandardizedBrandCount()
    ]);

    const stage6AveragePrice =
        getStage6AveragePrice();

    rows.push([
        "Giá trung bình",
        stage6AveragePrice === null
            ? ""
            : Math.round(stage6AveragePrice)
    ]);

    const discountedProducts =
        allProducts.filter(
            product =>
                getDiscount(product) > 0
        ).length;

    rows.push([
        "Sản phẩm giảm giá",
        discountedProducts
    ]);

    rows.push([]);

    rows.push([
        "TOP 10 THƯƠNG HIỆU"
    ]);

    rows.push([
        "Hạng",
        "Thương hiệu",
        "Số sản phẩm",
        "Tỷ trọng",
        "Giá TB",
        "Giảm giá TB"
    ]);

    const brandMap =
        new Map();

    allProducts.forEach(product => {
        const brandName =
            getBrandName(product);

        const brandKey =
            getBrandKey(product);

        if (!brandKey) {
            return;
        }

        if (!brandMap.has(brandKey)) {
            brandMap.set(brandKey, {
                name: brandName,
                count: 0,
                prices: [],
                discounts: []
            });
        }

        const item =
            brandMap.get(brandKey);

        item.count += 1;

        const price =
            getPrice(product);

        if (price !== null) {
            item.prices.push(price);
        }

        const discount =
            toNumber(
                product.discount_percent
            );

        if (
            discount !== null &&
            discount >= 0
        ) {
            item.discounts.push(discount);
        }
    });

    Array.from(
        brandMap.values()
    )
        .sort(
            (a, b) =>
                b.count - a.count
        )
        .slice(0, 10)
        .forEach(
            (brand, index) => {
                const averageBrandPrice =
                    brand.prices.length
                        ? brand.prices.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) / brand.prices.length
                        : null;

                const averageBrandDiscount =
                    brand.discounts.length
                        ? brand.discounts.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) / brand.discounts.length
                        : null;

                rows.push([
                    index + 1,
                    brand.name,
                    brand.count,
                    allProducts.length
                        ? Math.round(
                            brand.count /
                            allProducts.length *
                            100
                        ) + "%"
                        : "0%",
                    averageBrandPrice === null
                        ? "-"
                        : Math.round(
                            averageBrandPrice
                        ),
                    averageBrandDiscount === null
                        ? "-"
                        : Math.round(
                            averageBrandDiscount
                        ) + "%"
                ]);
            }
        );

    rows.push([]);

    rows.push([
        "PHÂN BỐ KHOẢNG GIÁ"
    ]);

    rows.push([
        "Khoảng giá",
        "Số lượng"
    ]);

    const prices = allProducts
        .map(getPrice)
        .filter(
            value => value !== null
        );

    const priceRanges = [
        [
            "Dưới 100K",
            0,
            100000
        ],
        [
            "100K - 300K",
            100000,
            300000
        ],
        [
            "300K - 500K",
            300000,
            500000
        ],
        [
            "500K - 1M",
            500000,
            1000000
        ],
        [
            "Trên 1M",
            1000000,
            Infinity
        ]
    ];

    priceRanges.forEach(
        range => {
            const count =
                prices.filter(
                    price => {
                        if (
                            range[2] ===
                            Infinity
                        ) {
                            return (
                                price >=
                                range[1]
                            );
                        }

                        return (
                            price >=
                            range[1] &&
                            price <
                            range[2]
                        );
                    }
                ).length;

            rows.push([
                range[0],
                count
            ]);
        }
    );

    rows.push([]);

    rows.push([
        "PHÂN BỐ MỨC GIẢM GIÁ"
    ]);

    rows.push([
        "Mức giảm",
        "Số lượng"
    ]);

    const discountRanges = [
        [
            "Không giảm",
            "0"
        ],
        [
            "1% - 10%",
            "1to10"
        ],
        [
            "11% - 20%",
            "11to20"
        ],
        [
            "21% - 30%",
            "21to30"
        ],
        [
            "Trên 30%",
            "over30"
        ]
    ];

    discountRanges.forEach(
        range => {
            const count =
                allProducts.filter(
                    product =>
                        getDiscountRange(
                            getDiscount(product)
                        ) === range[1]
                ).length;

            rows.push([
                range[0],
                count
            ]);
        }
    );

    const csv =
        rows
            .map(
                row =>
                    row
                        .map(csvEscape)
                        .join(",")
            )
            .join("\n");

    const blob =
        new Blob(
            ["\uFEFF" + csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "beautyprice_bao_cao_" +
        new Date()
            .toISOString()
            .slice(0, 10) +
        ".csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

document.addEventListener(
    "DOMContentLoaded",
    loadReport
);