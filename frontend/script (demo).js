// ==========================================
// BEAUTYPRICE INTELLIGENCE
// Dashboard - Dynamic CSV + Filter + Insight
// ==========================================

let allProducts = [];
let filteredProducts = [];

// ==========================================
// 1. ĐỌC VÀ PARSE CSV
// ==========================================

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            row.push(cell.trim());
            cell = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {

            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(cell.trim());
            cell = "";

            if (row.some(value => value !== "")) {
                rows.push(row);
            }

            row = [];
        } else {
            cell += char;
        }
    }

    // Xử lý dòng cuối
    if (cell !== "" || row.length > 0) {
        row.push(cell.trim());

        if (row.some(value => value !== "")) {
            rows.push(row);
        }
    }

    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0];

    return rows.slice(1).map(values => {
        const obj = {};

        headers.forEach((header, index) => {
            obj[header] = values[index] ?? "";
        });

        return obj;
    });
}


// ==========================================
// 2. CHUYỂN GIÁ TRỊ SANG NUMBER
// ==========================================

function toNumber(value) {
    if (value === undefined || value === null || value === "") {
        return 0;
    }

    const cleaned = String(value)
        .replace(/[^\d.-]/g, "");

    const number = Number(cleaned);

    return Number.isNaN(number) ? 0 : number;
}


// ==========================================
// 3. LẤY KHOẢNG GIÁ
// ==========================================

function getPriceRange(price) {
    if (price < 100000) {
        return "under100";
    }

    if (price < 300000) {
        return "100to300";
    }

    if (price < 500000) {
        return "300to500";
    }

    return "over500";
}


// ==========================================
// 4. LẤY KHOẢNG GIẢM GIÁ
// ==========================================

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


// ==========================================
// 5. FORMAT TIỀN
// ==========================================

function formatCurrency(value) {
    return Math.round(value).toLocaleString("vi-VN") + "đ";
}


// ==========================================
// 6. CẬP NHẬT KPI
// ==========================================

function updateKPI(products) {

    const totalProducts = products.length;

    const brands = products
        .map(product => product.brand?.trim())
        .filter(brand => brand);

    const uniqueBrands = [...new Set(brands)];

    const prices = products
        .map(product => toNumber(product.current_price_vnd))
        .filter(price => price > 0);

    const averagePrice =
        prices.length > 0
            ? prices.reduce((sum, price) => sum + price, 0) / prices.length
            : 0;

    const discountedProducts = products.filter(product => {
        const discount = toNumber(product.discount_percent);
        return discount > 0;
    }).length;


    // Tổng sản phẩm
    const totalProductsElement =
        document.getElementById("totalProducts");

    if (totalProductsElement) {
        totalProductsElement.textContent =
            totalProducts.toLocaleString("vi-VN");
    }


    // Số thương hiệu
    const totalBrandsElement =
        document.getElementById("totalBrands");

    if (totalBrandsElement) {
        totalBrandsElement.textContent =
            uniqueBrands.length.toLocaleString("vi-VN");
    }


    // Giá trung bình
    const averagePriceElement =
        document.getElementById("averagePrice");

    if (averagePriceElement) {
        averagePriceElement.textContent =
            formatCurrency(averagePrice);
    }


    // Số sản phẩm giảm giá
    const discountedProductsElement =
        document.getElementById("discountedProducts");

    if (discountedProductsElement) {
        discountedProductsElement.textContent =
            discountedProducts.toLocaleString("vi-VN");
    }


    // Cập nhật dòng mô tả
    const kpiCards =
        document.querySelectorAll(".kpi-card");

    if (kpiCards.length >= 4) {

        kpiCards[0].querySelector("small").textContent =
            `${totalProducts.toLocaleString("vi-VN")} sản phẩm sau lọc`;

        kpiCards[1].querySelector("small").textContent =
            `${uniqueBrands.length} thương hiệu được ghi nhận`;

        kpiCards[2].querySelector("small").textContent =
            "Giá niêm yết hiện tại";

        kpiCards[3].querySelector("small").textContent =
            `Trong tổng số ${totalProducts.toLocaleString("vi-VN")} sản phẩm`;
    }
}


// ==========================================
// 7. TOP THƯƠNG HIỆU
// ==========================================

function updateTopBrands(products) {

    const brandList =
        document.getElementById("brandList");

    if (!brandList) {
        return;
    }

    const brandCounts = {};

    products.forEach(product => {

        const brand =
            product.brand?.trim();

        if (!brand) {
            return;
        }

        brandCounts[brand] =
            (brandCounts[brand] || 0) + 1;
    });


    const sortedBrands =
        Object.entries(brandCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);


    if (sortedBrands.length === 0) {

        brandList.innerHTML =
            "<p>Không có dữ liệu.</p>";

        return;
    }


    const maxCount =
        sortedBrands[0][1];


    brandList.innerHTML =
        sortedBrands.map(([brand, count]) => {

            const width =
                maxCount > 0
                    ? (count / maxCount) * 100
                    : 0;

            return `
                <div class="brand-row">
                    <span>${brand}</span>

                    <div class="bar">
                        <div style="width:${width}%"></div>
                    </div>

                    <strong>${count}</strong>
                </div>
            `;

        }).join("");
}


// ==========================================
// 8. PHÂN BỐ GIÁ
// ==========================================

function updatePriceDistribution(products) {

    const priceColumns =
        document.querySelectorAll(".price-column");

    if (priceColumns.length < 4) {
        return;
    }


    const ranges = {
        under100: 0,
        "100to300": 0,
        "300to500": 0,
        over500: 0
    };


    products.forEach(product => {

        const price =
            toNumber(product.current_price_vnd);

        if (price <= 0) {
            return;
        }

        const range =
            getPriceRange(price);

        ranges[range]++;
    });


    const values = [
        ranges.under100,
        ranges["100to300"],
        ranges["300to500"],
        ranges.over500
    ];


    const maxValue =
        Math.max(...values, 1);


    priceColumns.forEach((column, index) => {

        const value =
            values[index];

        const valueElement =
            column.querySelector(".column-value");

        const barElement =
            column.querySelector(".column");


        if (valueElement) {
            valueElement.textContent = value;
        }


        if (barElement) {

            const minHeight = 20;
            const maxHeight = 150;

            const height =
                value === 0
                    ? 0
                    : minHeight +
                      (value / maxValue) *
                      (maxHeight - minHeight);

            barElement.style.height =
                `${height}px`;
        }
    });
}


// ==========================================
// 9. PHÂN BỐ GIẢM GIÁ
// ==========================================

function updateDiscountDistribution(products) {

    const discountList =
        document.querySelector(".discount-list");

    if (!discountList) {
        return;
    }


    const ranges = {
        "0": 0,
        "1to10": 0,
        "11to20": 0,
        "21to30": 0,
        over30: 0
    };


    products.forEach(product => {

        const discount =
            toNumber(product.discount_percent);

        const range =
            getDiscountRange(discount);

        ranges[range]++;
    });


    const data = [
        ["0%", ranges["0"]],
        ["1% – 10%", ranges["1to10"]],
        ["11% – 20%", ranges["11to20"]],
        ["21% – 30%", ranges["21to30"]],
        ["Trên 30%", ranges.over30]
    ];


    discountList.innerHTML =
        data.map(([label, count]) => {

            return `
                <div>
                    <span>${label}</span>
                    <strong>${count} sản phẩm</strong>
                </div>
            `;

        }).join("");
}


// ==========================================
// 10. INSIGHT TỰ ĐỘNG
// ==========================================

function updateInsights(products) {

    const insightCard =
        document.querySelector(".insight-card");

    if (!insightCard) {
        return;
    }


    const insightContainer =
        insightCard.querySelectorAll(".insight");


    // Không có dữ liệu
    if (products.length === 0) {

        insightContainer.forEach(
            insight => insight.remove()
        );

        return;
    }


    // ======================================
    // Insight 1: Khoảng giá phổ biến nhất
    // ======================================

    const priceRanges = {
        "Dưới 100.000đ": 0,
        "100.000đ – 300.000đ": 0,
        "300.000đ – 500.000đ": 0,
        "Trên 500.000đ": 0
    };


    products.forEach(product => {

        const price =
            toNumber(product.current_price_vnd);

        if (price < 100000) {
            priceRanges["Dưới 100.000đ"]++;
        }
        else if (price < 300000) {
            priceRanges["100.000đ – 300.000đ"]++;
        }
        else if (price < 500000) {
            priceRanges["300.000đ – 500.000đ"]++;
        }
        else {
            priceRanges["Trên 500.000đ"]++;
        }
    });


    const mostPopularPrice =
        Object.entries(priceRanges)
            .sort((a, b) => b[1] - a[1])[0];


    // ======================================
    // Insight 2: Tỷ lệ giảm giá
    // ======================================

    const discountedCount =
        products.filter(product => {
            return toNumber(product.discount_percent) > 0;
        }).length;


    const discountRate =
        products.length > 0
            ? (discountedCount / products.length) * 100
            : 0;


    // ======================================
    // Insight 3: Thương hiệu nổi bật
    // ======================================

    const brandCounts = {};

    products.forEach(product => {

        const brand =
            product.brand?.trim();

        if (!brand) {
            return;
        }

        brandCounts[brand] =
            (brandCounts[brand] || 0) + 1;
    });


    const topBrand =
        Object.entries(brandCounts)
            .sort((a, b) => b[1] - a[1])[0];


    // ======================================
    // Render insight
    // ======================================

    insightCard.innerHTML = `
        <div class="card-header">
            <div>
                <h3>Insight nhanh</h3>
                <p>Tóm tắt từ dữ liệu hiện tại</p>
            </div>
        </div>

        <div class="insight">
            <div class="insight-number">01</div>

            <p>
                Khoảng giá
                <strong>${mostPopularPrice[0]}</strong>
                đang có số lượng sản phẩm nhiều nhất,
                với <strong>${mostPopularPrice[1]}</strong>
                sản phẩm.
            </p>
        </div>

        <div class="insight">
            <div class="insight-number">02</div>

            <p>
                Có
                <strong>${discountedCount}/${products.length}</strong>
                sản phẩm đang giảm giá,
                tương đương
                <strong>${discountRate.toFixed(1)}%</strong>
                dữ liệu hiện tại.
            </p>
        </div>

        ${
            topBrand
            ? `
            <div class="insight">
                <div class="insight-number">03</div>

                <p>
                    <strong>${topBrand[0]}</strong>
                    là thương hiệu có nhiều sản phẩm nhất
                    trong tập dữ liệu hiện tại,
                    với <strong>${topBrand[1]}</strong> sản phẩm.
                </p>
            </div>
            `
            : ""
        }
    `;
}


// ==========================================
// 11. CẬP NHẬT TOÀN BỘ DASHBOARD
// ==========================================

function updateDashboard(products) {

    filteredProducts = products;

    updateKPI(products);

    updateTopBrands(products);

    updatePriceDistribution(products);

    updateDiscountDistribution(products);

    updateInsights(products);

    console.log(
        "Dashboard updated:",
        products.length,
        "products"
    );
}


// ==========================================
// 12. BỘ LỌC
// ==========================================

function applyFilters() {

    const filterGroups =
        document.querySelectorAll(".filter-group");

    if (filterGroups.length < 4) {
        return;
    }


    const sourceSelect =
        filterGroups[0].querySelector("select");

    const brandSelect =
        filterGroups[1].querySelector("select");

    const priceSelect =
        filterGroups[2].querySelector("select");

    const discountSelect =
        filterGroups[3].querySelector("select");


    const sourceValue =
        sourceSelect?.value || "Hasaki";

    const brandValue =
        brandSelect?.value || "Tất cả thương hiệu";

    const priceValue =
        priceSelect?.value || "Tất cả mức giá";

    const discountValue =
        discountSelect?.value || "Tất cả";


    let result =
        [...allProducts];


    // ======================================
    // Lọc nguồn
    // ======================================

    if (
        sourceValue &&
        sourceValue !== "Tất cả nguồn dữ liệu"
    ) {

        result =
            result.filter(product => {

                const source =
                    product.source?.trim();

                return source === sourceValue;
            });
    }


    // ======================================
    // Lọc thương hiệu
    // ======================================

    if (
        brandValue &&
        brandValue !== "Tất cả thương hiệu"
    ) {

        result =
            result.filter(product => {

                return (
                    product.brand?.trim() ===
                    brandValue
                );
            });
    }


    // ======================================
    // Lọc khoảng giá
    // ======================================

    if (
        priceValue &&
        priceValue !== "Tất cả mức giá"
    ) {

        result =
            result.filter(product => {

                const price =
                    toNumber(
                        product.current_price_vnd
                    );


                switch (priceValue) {

                    case "Dưới 100.000đ":
                        return price < 100000;

                    case "100.000đ - 300.000đ":
                        return (
                            price >= 100000 &&
                            price < 300000
                        );

                    case "300.000đ - 500.000đ":
                        return (
                            price >= 300000 &&
                            price < 500000
                        );

                    case "Trên 500.000đ":
                        return price >= 500000;

                    default:
                        return true;
                }
            });
    }


    // ======================================
    // Lọc giảm giá
    // ======================================

    if (
        discountValue &&
        discountValue !== "Tất cả"
    ) {

        result =
            result.filter(product => {

                const discount =
                    toNumber(
                        product.discount_percent
                    );


                switch (discountValue) {

                    case "0%":
                        return discount === 0;

                    case "1% - 10%":
                        return (
                            discount >= 1 &&
                            discount <= 10
                        );

                    case "11% - 20%":
                        return (
                            discount >= 11 &&
                            discount <= 20
                        );

                    case "21% - 30%":
                        return (
                            discount >= 21 &&
                            discount <= 30
                        );

                    case "Trên 30%":
                        return discount > 30;

                    default:
                        return true;
                }
            });
    }


    // Cập nhật dashboard
    updateDashboard(result);


    console.log("Filters:", {
        source: sourceValue,
        brand: brandValue,
        price: priceValue,
        discount: discountValue,
        resultCount: result.length
    });
}


// ==========================================
// 13. TẠO DANH SÁCH BRAND TỪ CSV
// ==========================================

function populateBrandFilter() {

    const filterGroups =
        document.querySelectorAll(".filter-group");

    if (filterGroups.length < 2) {
        return;
    }


    const brandSelect =
        filterGroups[1].querySelector("select");

    if (!brandSelect) {
        return;
    }


    const currentValue =
        brandSelect.value;


    const brands =
        [...new Set(
            allProducts
                .map(product => product.brand?.trim())
                .filter(brand => brand)
        )]
        .sort((a, b) =>
            a.localeCompare(b, "vi")
        );


    brandSelect.innerHTML = `
        <option>Tất cả thương hiệu</option>
    `;


    brands.forEach(brand => {

        const option =
            document.createElement("option");

        option.value = brand;

        option.textContent = brand;

        brandSelect.appendChild(option);
    });


    // Nếu brand cũ vẫn tồn tại thì giữ lại
    if (brands.includes(currentValue)) {
        brandSelect.value = currentValue;
    }
}


// ==========================================
// 14. NÚT ĐẶT LẠI
// ==========================================

function resetFilters() {

    const filterGroups =
        document.querySelectorAll(".filter-group");


    if (filterGroups.length >= 4) {

        filterGroups[0].querySelector("select").value =
            "Hasaki";

        filterGroups[1].querySelector("select").value =
            "Tất cả thương hiệu";

        filterGroups[2].querySelector("select").value =
            "Tất cả mức giá";

        filterGroups[3].querySelector("select").value =
            "Tất cả";
    }


    // Trả dashboard về toàn bộ dữ liệu
    updateDashboard(allProducts);


    console.log("Filters reset.");
}


// ==========================================
// 15. GẮN EVENT CHO FILTER
// ==========================================

function setupFilters() {

    const selects =
        document.querySelectorAll(
            ".filter-group select"
        );


    selects.forEach(select => {

        select.addEventListener(
            "change",
            applyFilters
        );
    });


    const resetButton =
        document.querySelector(".reset-btn");


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetFilters
        );
    }
}


// ==========================================
// 16. ĐỌC FILE CSV
// ==========================================

async function loadCSV() {

    try {

        const response =
            await fetch(
                "hasaki_products_pages_1_9.csv"
            );


        if (!response.ok) {
            throw new Error(
                `HTTP error: ${response.status}`
            );
        }


        const text =
            await response.text();


        allProducts =
            parseCSV(text);


        console.log(
            "CSV loaded:",
            allProducts.length,
            "products"
        );


        if (allProducts.length === 0) {

            console.warn(
                "CSV không có dữ liệu."
            );

            return;
        }


        // Tạo dropdown brand từ CSV
        populateBrandFilter();


        // Gắn filter
        setupFilters();


        // Hiển thị toàn bộ dữ liệu
        updateDashboard(allProducts);


        // Kiểm tra dữ liệu
        const discountTotal =
            allProducts.filter(product => {

                const discount =
                    toNumber(
                        product.discount_percent
                    );

                return discount > 0;

            }).length;


        console.log(
            "Discounted products:",
            discountTotal
        );


        console.log(
            "Discount groups:",
            {
                "0%": allProducts.filter(
                    p => getDiscountRange(
                        toNumber(p.discount_percent)
                    ) === "0"
                ).length,

                "1-10%": allProducts.filter(
                    p => getDiscountRange(
                        toNumber(p.discount_percent)
                    ) === "1to10"
                ).length,

                "11-20%": allProducts.filter(
                    p => getDiscountRange(
                        toNumber(p.discount_percent)
                    ) === "11to20"
                ).length,

                "21-30%": allProducts.filter(
                    p => getDiscountRange(
                        toNumber(p.discount_percent)
                    ) === "21to30"
                ).length,

                ">30%": allProducts.filter(
                    p => getDiscountRange(
                        toNumber(p.discount_percent)
                    ) === "over30"
                ).length
            }
        );


    } catch (error) {

        console.error(
            "Không thể đọc CSV:",
            error
        );


        alert(
            "Không thể đọc file dữ liệu. " +
            "Hãy kiểm tra file CSV và Live Server."
        );
    }
}


// ==========================================
// 17. CHẠY KHI TRANG LOAD
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    loadCSV
);