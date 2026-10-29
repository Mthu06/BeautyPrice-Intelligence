const isLoggedIn =
    sessionStorage.getItem("beautyprice_logged_in") === "true";

if (!isLoggedIn) {

    window.location.href = "login.html";

    throw new Error(
        "Chưa đăng nhập. Đã chuyển về trang đăng nhập."
    );
}

const CLUSTER_API =
    "http://127.0.0.1:5000/api/clusters";

let allProducts = [];

let allClusters = [];

let filteredProducts = [];

let clusterSummary = [];

let currentPage = 1;

const PRODUCTS_PER_PAGE = 100;

let clusterChart = null;

function logout() {

    sessionStorage.removeItem(
        "beautyprice_logged_in"
    );

    sessionStorage.removeItem(
        "beautyprice_role"
    );

    window.location.href =
        "login.html";
}

function formatCurrency(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return Math.round(number).toLocaleString("vi-VN") + "đ";
}

function formatPercent(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toFixed(2) + "%";
}

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getField(
    product,
    fieldNames
) {

    for (const field of fieldNames) {

        if (
            product[field] !== undefined &&
            product[field] !== null &&
            product[field] !== "" &&
            String(product[field]).trim().toLowerCase() !== "nan"
        ) {

            return product[field];

        }

    }

    return null;
}

function calculateMedian(values) {

    const numbers =
        values
            .map(Number)
            .filter(
                value =>
                    Number.isFinite(value) && value > 0
            )
            .sort(
                (a, b) => a - b
            );

    if (numbers.length === 0) {
        return null;
    }

    const middle =
        Math.floor(
            numbers.length / 2
        );

    if (
        numbers.length % 2 === 0
    ) {

        return (
            numbers[middle - 1] +
            numbers[middle]
        ) / 2;

    }

    return numbers[middle];
}

function calculateMean(values) {

    const numbers =
        values
            .map(Number)
            .filter(
                value =>
                    Number.isFinite(value)
            );

    if (numbers.length === 0) {
        return null;
    }

    return (
        numbers.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        numbers.length
    );
}

function getMostCommonValue(values) {

    const validValues =
        values
            .filter(
                value =>
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== "" &&
                    String(value).trim().toLowerCase() !== "nan" &&
                    String(value).trim().toLowerCase() !== "unknown"
            )
            .map(
                value =>
                    String(value).trim()
            );

    if (
        validValues.length === 0
    ) {

        return "Mỹ phẩm & Chăm sóc da";

    }

    const counter = {};

    validValues.forEach(
        value => {

            counter[value] =
                (counter[value] || 0) + 1;

        }
    );

    return Object.entries(counter)
        .sort(
            (a, b) =>
                b[1] - a[1]
        )[0][0];
}

function buildClusterSummary() {

    if (
        !Array.isArray(allProducts) ||
        allProducts.length === 0
    ) {

        clusterSummary = [];

        return;

    }

    const groups = {};

    allProducts.forEach(
        product => {

            const cluster =
                getField(
                    product,
                    [
                        "cluster",
                        "Cluster"
                    ]
                );

            if (
                cluster === null ||
                cluster === undefined ||
                cluster === ""
            ) {

                return;

            }

            const key =
                String(cluster);

            if (!groups[key]) {

                groups[key] = [];

            }

            groups[key].push(
                product
            );

        }
    );

    const totalProducts =
        allProducts.length;

    clusterSummary =
        Object.entries(groups)
            .map(
                (
                    [
                        cluster,
                        products
                    ]
                ) => {

                    const prices =
                        products.map(
                            product =>
                                getField(
                                    product,
                                    [
                                        "current_price_vnd",
                                        "current_price",
                                        "price"
                                    ]
                                )
                        );

                    const discounts =
                        products.map(
                            product =>
                                getField(
                                    product,
                                    [
                                        "discount_percent",
                                        "discount_percent_source",
                                        "discount_percent_model"
                                    ]
                                )
                        );

                    const ratings =
                        products.map(
                            product =>
                                getField(
                                    product,
                                    [
                                        "rating",
                                        "rating_model",
                                        "average_rating"
                                    ]
                                )
                        );

                    const categories =
                        products.map(
                            product =>
                                getField(
                                    product,
                                    [
                                        "primary_category",
                                        "category",
                                        "category_name",
                                        "product_type"
                                    ]
                                )
                        );

                    const retailers =
                        products.map(
                            product =>
                                getField(
                                    product,
                                    [
                                        "retailer_id",
                                        "retailer",
                                        "shop",
                                        "seller"
                                    ]
                                )
                        );

                    const meanPrice =
                        calculateMean(
                            prices
                        );

                    const medianPrice =
                        calculateMedian(
                            prices
                        );

                    const medianDiscount =
                        calculateMedian(
                            discounts
                        );

                    const medianRating =
                        calculateMedian(
                            ratings
                        );

                    return {

                        cluster:
                            Number(cluster),

                        product_count:
                            products.length,

                        listing_share_percent:
                            (
                                products.length /
                                totalProducts
                            ) * 100,

                        median_price_vnd:
                            medianPrice,

                        mean_price_vnd:
                            meanPrice,

                        median_discount_percent:
                            medianDiscount,

                        median_rating:
                            medianRating,

                        top_category:
                            getMostCommonValue(
                                categories
                            ),

                        top_retailer:
                            getMostCommonValue(
                                retailers
                            )

                    };

                }
            )
            .sort(
                (a, b) =>
                    a.cluster -
                    b.cluster
            );

    console.log(
        "Cluster summary:",
        clusterSummary
    );
}

async function loadClusterData() {

    try {

        const response =
            await fetch(
                CLUSTER_API
            );

        if (!response.ok) {

            throw new Error(
                "Không thể kết nối API phân khúc."
            );

        }

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                result.message ||
                "API phân khúc trả về lỗi."
            );

        }

        allProducts =
            Array.isArray(
                result.products
            )
                ? result.products
                : [];

        allClusters =
            Array.isArray(
                result.clusters
            )
                ? result.clusters
                : [];

        filteredProducts =
            [
                ...allProducts
            ];

        buildClusterSummary();

        renderKPI();

        renderClusterChart();

        populateClusterFilter();

        renderClusterCards();

        renderTable();

        renderInsight();

    } catch (error) {

        console.error(
            "Lỗi load cluster:",
            error
        );

        showError(
            "Không thể tải dữ liệu phân khúc. Hãy kiểm tra backend Flask."
        );

    }
}

function renderKPI() {

    const totalProducts =
        allProducts.length;

    const totalClusters =
        allClusters.length;

    const largestCluster =
        allClusters.reduce(
            (
                largest,
                current
            ) => {

                if (
                    !largest ||
                    Number(
                        current.count
                    ) >
                    Number(
                        largest.count
                    )
                ) {

                    return current;

                }

                return largest;

            },
            null
        );

    const totalElement =
        document.getElementById(
            "totalProducts"
        );

    const clusterElement =
        document.getElementById(
            "totalClusters"
        );

    const largestElement =
        document.getElementById(
            "largestCluster"
        );

    const percentElement =
        document.getElementById(
            "largestClusterPercent"
        );

    if (totalElement) {

        totalElement.textContent =
            totalProducts.toLocaleString(
                "vi-VN"
            );

    }

    if (clusterElement) {

        clusterElement.textContent =
            totalClusters;

    }

    if (largestElement) {

        largestElement.textContent =
            largestCluster
                ? `Cluster ${largestCluster.cluster}`
                : "—";

    }

    if (percentElement) {

        percentElement.textContent =
            largestCluster
                ? formatPercent(
                    largestCluster.percentage
                )
                : "—";

    }

}

function renderClusterChart() {

    const canvas =
        document.getElementById(
            "clusterChart"
        );

    if (!canvas) {
        return;
    }

    if (clusterChart) {

        clusterChart.destroy();

    }

    const labels =
        allClusters.map(
            item =>
                `Cluster ${item.cluster}`
        );

    const values =
        allClusters.map(
            item =>
                Number(item.count)
        );

    clusterChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Số sản phẩm",

                            data:
                                values,

                            backgroundColor:
                                "#6c5ce7",

                            borderColor:
                                "#6c5ce7",

                            borderWidth: 0,

                            borderRadius: 7,

                            borderSkipped:
                                false

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        const index =
                                            context.dataIndex;

                                        const cluster =
                                            allClusters[
                                                index
                                            ];

                                        return (
                                            ` ${
                                                Number(
                                                    cluster.count
                                                ).toLocaleString(
                                                    "vi-VN"
                                                )
                                            } sản phẩm`
                                        );

                                    }

                            }

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                precision:
                                    0,

                                color:
                                    "#777"

                            },

                            grid: {

                                color:
                                    "#eeeef3"

                            }

                        },

                        x: {

                            ticks: {

                                color:
                                    "#777"

                            },

                            grid: {

                                display:
                                    false

                            }

                        }

                    }

                }

            }
        );

}

function populateClusterFilter() {

    const select =
        document.getElementById(
            "clusterFilter"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `

        <option value="all">
            Tất cả phân khúc
        </option>

    `;

    allClusters.forEach(
        item => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(
                    item.cluster
                );

            option.textContent =
                `Cluster ${item.cluster}`;

            select.appendChild(
                option
            );

        }
    );

}

function setupFilter() {

    const select =
        document.getElementById(
            "clusterFilter"
        );

    if (!select) {
        return;
    }

    select.addEventListener(
        "change",
        function () {

            const value =
                this.value;

            if (
                value === "all"
            ) {

                filteredProducts =
                    [
                        ...allProducts
                    ];

            } else {

                filteredProducts =
                    allProducts.filter(
                        product =>
                            String(
                                product.cluster
                            ) ===
                            String(value)
                    );

            }

            currentPage = 1;

            renderTable();

        }
    );

}

function renderClusterCards() {

    const container =
        document.getElementById(
            "clusterCards"
        );

    if (!container) {
        return;
    }

    if (
        clusterSummary.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                Chưa có dữ liệu thống kê phân khúc.

            </div>

        `;

        return;

    }

    container.innerHTML =
        clusterSummary
            .map(
                item => {

                    const cluster =
                        Number(
                            item.cluster
                        );

                    const count =
                        Number(
                            item.product_count
                        );

                    const share =
                        Number(
                            item.listing_share_percent
                        );

                    const medianPrice =
                        Number(
                            item.median_price_vnd
                        );

                    const meanPrice =
                        Number(
                            item.mean_price_vnd
                        );

                    const discount =
                        Number(
                            item.median_discount_percent
                        );

                    const rating =
                        Number(
                            item.median_rating
                        );

                    const category =
                        item.top_category ||
                        "Mỹ phẩm & Chăm sóc da";

                    const retailer =
                        item.top_retailer ||
                        "Không rõ";

                    return `

                        <div class="cluster-card">

                            <div class="cluster-card-top">

                                <span class="cluster-badge">
                                    Cluster ${cluster}
                                </span>

                                <span class="cluster-share">
                                    ${formatPercent(
                                        share
                                    )}
                                </span>

                            </div>

                            <div class="cluster-count">

                                ${count.toLocaleString(
                                    "vi-VN"
                                )}

                            </div>

                            <div class="cluster-label">

                                sản phẩm

                            </div>

                            <div class="cluster-info">

                                <div>

                                    <span>
                                        Giá trung vị
                                    </span>

                                    <strong>
                                        ${formatCurrency(
                                            medianPrice
                                        )}
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Giá trung bình
                                    </span>

                                    <strong>
                                        ${formatCurrency(
                                            meanPrice
                                        )}
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Giảm giá trung vị
                                    </span>

                                    <strong>
                                        ${
                                            Number.isFinite(
                                                discount
                                            )
                                                ? formatPercent(
                                                    discount
                                                )
                                                : "—"
                                        }
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Rating trung vị
                                    </span>

                                    <strong>
                                        ${
                                            Number.isFinite(
                                                rating
                                            )
                                                ? rating.toFixed(
                                                    1
                                                )
                                                : "—"
                                        }
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Danh mục nổi bật
                                    </span>

                                    <strong>
                                        ${escapeHTML(
                                            category
                                        )}
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Nhà bán lẻ
                                    </span>

                                    <strong>
                                        ${escapeHTML(
                                            retailer
                                        )}
                                    </strong>

                                </div>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}

function renderTable() {

    const tbody =
        document.getElementById(
            "clusterTableBody"
        );

    if (!tbody) {
        return;
    }

    const total =
        filteredProducts.length;

    const totalPages =
        Math.ceil(
            total /
            PRODUCTS_PER_PAGE
        );

    if (
        currentPage > totalPages &&
        totalPages > 0
    ) {

        currentPage =
            totalPages;

    }

    const start =
        (currentPage - 1) *
        PRODUCTS_PER_PAGE;

    const end =
        start +
        PRODUCTS_PER_PAGE;

    const pageProducts =
        filteredProducts.slice(
            start,
            end
        );

    tbody.innerHTML = "";

    if (
        pageProducts.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="4"
                    style="
                        text-align:center;
                        padding:35px;
                        color:#999;
                    "
                >

                    Không có sản phẩm trong phân khúc này.

                </td>

            </tr>

        `;

    } else {

        pageProducts.forEach(
            (
                product,
                index
            ) => {

                const row =
                    document.createElement(
                        "tr"
                    );

                const number =
                    start +
                    index +
                    1;

                row.innerHTML = `

                    <td>
                        ${number}
                    </td>

                    <td>

                        <div class="product-name-cell">

                            ${escapeHTML(
                                product.product_name
                            )}

                        </div>

                    </td>

                    <td>

                        <div class="price-cell">

                            ${formatCurrency(
                                product.current_price_vnd
                            )}

                        </div>

                    </td>

                    <td>

                        <span class="cluster-table-badge">

                            Cluster ${
                                Number(
                                    product.cluster
                                )
                            }

                        </span>

                    </td>

                `;

                tbody.appendChild(
                    row
                );

            }
        );

    }

    renderPagination(
        totalPages
    );

    updateTableResultInfo(
        total,
        start,
        end
    );

}

function updateTableResultInfo(
    total,
    start,
    end
) {

    const element =
        document.getElementById(
            "tableResultInfo"
        );

    if (!element) {
        return;
    }

    if (total === 0) {

        element.textContent =
            "Không có sản phẩm";

        return;

    }

    const actualEnd =
        Math.min(
            end,
            total
        );

    element.textContent =
        `Hiển thị ${
            (
                start + 1
            ).toLocaleString(
                "vi-VN"
            )
        }–${
            actualEnd.toLocaleString(
                "vi-VN"
            )
        } trong ${
            total.toLocaleString(
                "vi-VN"
            )
        } sản phẩm`;

}

function renderPagination(
    totalPages
) {

    const container =
        document.getElementById(
            "pagination"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        totalPages <= 1
    ) {

        return;

    }

    const previous =
        document.createElement(
            "button"
        );

    previous.className =
        "page-btn";

    previous.textContent =
        "‹";

    previous.disabled =
        currentPage === 1;

    previous.addEventListener(
        "click",
        function () {

            if (
                currentPage > 1
            ) {

                currentPage--;

                renderTable();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }

        }
    );

    container.appendChild(
        previous
    );

    const maxButtons = 7;

    let startPage =
        Math.max(
            1,
            currentPage -
            Math.floor(
                maxButtons / 2
            )
        );

    let endPage =
        Math.min(
            totalPages,
            startPage +
            maxButtons -
            1
        );

    if (
        endPage -
        startPage +
        1 <
        maxButtons
    ) {

        startPage =
            Math.max(
                1,
                endPage -
                maxButtons +
                1
            );

    }

    for (
        let page = startPage;
        page <= endPage;
        page++
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "page-btn";

        if (
            page === currentPage
        ) {

            button.classList.add(
                "active"
            );

        }

        button.textContent =
            page;

        button.addEventListener(
            "click",
            function () {

                currentPage =
                    page;

                renderTable();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

        container.appendChild(
            button
        );

    }

    const next =
        document.createElement(
            "button"
        );

    next.className =
        "page-btn";

    next.textContent =
        "›";

    next.disabled =
        currentPage === totalPages;

    next.addEventListener(
        "click",
        function () {

            if (
                currentPage <
                totalPages
            ) {

                currentPage++;

                renderTable();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }

        }
    );

    container.appendChild(
        next
    );

}

function renderInsight() {

    const container =
        document.getElementById(
            "clusterInsight"
        );

    if (!container) {
        return;
    }

    if (
        clusterSummary.length === 0
    ) {

        container.innerHTML = "";

        return;

    }

    const largest =
        [
            ...clusterSummary
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.product_count
                    ) -
                    Number(
                        a.product_count
                    )
            )[0];

    const highestMeanPrice =
        [
            ...clusterSummary
        ]
            .filter(
                item =>
                    Number.isFinite(
                        Number(
                            item.mean_price_vnd
                        )
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.mean_price_vnd
                    ) -
                    Number(
                        a.mean_price_vnd
                    )
            )[0];

    const highestDiscount =
        [
            ...clusterSummary
        ]
            .filter(
                item =>
                    Number.isFinite(
                        Number(
                            item.median_discount_percent
                        )
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.median_discount_percent
                    ) -
                    Number(
                        a.median_discount_percent
                    )
            )[0];

    const highestRating =
        [
            ...clusterSummary
        ]
            .filter(
                item =>
                    Number.isFinite(
                        Number(
                            item.median_rating
                        )
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.median_rating
                    ) -
                    Number(
                        a.median_rating
                    )
            )[0];

    const insights = [];

    if (largest) {

        insights.push({

            title:
                "Phân khúc chiếm tỷ trọng lớn nhất",

            text:
                `Cluster ${
                    largest.cluster
                } có ${
                    Number(
                        largest.product_count
                    ).toLocaleString(
                        "vi-VN"
                    )
                } sản phẩm, chiếm ${
                    formatPercent(
                        largest.listing_share_percent
                    )
                } tổng dữ liệu.`

        });

    }

    if (highestMeanPrice) {

        insights.push({

            title:
                "Mức giá nổi bật",

            text:
                `Cluster ${
                    highestMeanPrice.cluster
                } có giá trung bình cao nhất, khoảng ${
                    formatCurrency(
                        highestMeanPrice.mean_price_vnd
                    )
                }.`

        });

    }

    if (highestDiscount) {

        insights.push({

            title:
                "Mức giảm giá nổi bật",

            text:
                `Cluster ${
                    highestDiscount.cluster
                } có mức giảm giá trung vị cao nhất, khoảng ${
                    formatPercent(
                        highestDiscount.median_discount_percent
                    )
                }.`

        });

    }

    if (highestRating) {

        insights.push({

            title:
                "Đánh giá sản phẩm",

            text:
                `Cluster ${
                    highestRating.cluster
                } có rating trung vị cao nhất ở mức ${
                    Number(
                        highestRating.median_rating
                    ).toFixed(
                        1
                    )
                }.`

        });

    }

    container.innerHTML =
        insights
            .map(
                item => `

                    <div class="insight-item">

                        <strong>
                            ${escapeHTML(
                                item.title
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                item.text
                            )}
                        </span>

                    </div>

                `
            )
            .join("");

}

function showError(
    message
) {

    const elements = [

        "totalProducts",
        "totalClusters",
        "largestCluster",
        "largestClusterPercent"

    ];

    elements.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.textContent =
                    "—";

            }

        }
    );

    const chartCards =
        document.getElementById(
            "clusterCards"
        );

    if (chartCards) {

        chartCards.innerHTML = `

            <div
                class="empty-state"
                style="
                    grid-column:1/-1;
                    padding:30px;
                    background:#fff;
                    border:1px solid #ebe9f2;
                    border-radius:14px;
                    color:#999;
                    text-align:center;
                "
            >

                ${escapeHTML(
                    message
                )}

            </div>

        `;

    }

}

function setupUserRole() {

    const role =
        sessionStorage.getItem(
            "beautyprice_role"
        );

    const avatar =
        document.getElementById(
            "userAvatar"
        );

    const roleElement =
        document.getElementById(
            "userRole"
        );

    const roleText =
        document.getElementById(
            "userRoleText"
        );

    if (
        role === "admin"
    ) {

        if (avatar) {

            avatar.textContent =
                "A";

        }

        if (roleElement) {

            roleElement.textContent =
                "ADMIN";

        }

        if (roleText) {

            roleText.textContent =
                "Quản trị viên";

        }

    } else {

        if (avatar) {

            avatar.textContent =
                "U";

        }

        if (roleElement) {

            roleElement.textContent =
                "USER";

        }

        if (roleText) {

            roleText.textContent =
                "Người dùng";

        }

    }

}

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        setupUserRole();

        setupFilter();

        await loadClusterData();

    }
);