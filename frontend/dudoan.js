const PREDICTION_API =
    "http://127.0.0.1:5000/api/predictions";

let predictionData = [];
let modelInfo = {
    mae: 87918.90,
    rmse: 145603.04,
    r2: 0.6524,
    mape: 43.31527453221777
};

let priceThresholds = {
    q1: 169000,
    q2: 340000
};

function formatCurrency(value) {

    const number =
        Number(value || 0);

    return Math.round(number)
        .toLocaleString("vi-VN") + "đ";

}

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function shortenProductName(
    name,
    maxLength = 18
) {

    const text =
        String(name || "")
            .trim();

    if (
        text.length <= maxLength
    ) {

        return text;

    }

    return (
        text.substring(
            0,
            maxLength
        ).trim() + "..."
    );

}

function getPriceGroup(price) {

    const value =
        Number(price || 0);


    if (
        value <=
        priceThresholds.q1
    ) {

        return "Thấp";

    }


    if (
        value <=
        priceThresholds.q2
    ) {

        return "Trung bình";

    }


    return "Cao";

}

async function loadPredictionData() {

    const tableBody =
        document.getElementById(
            "predictionTableBody"
        );


    if (
        tableBody
    ) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="loading"
                >
                    Đang tải kết quả dự đoán...
                </td>
            </tr>
        `;

    }


    try {

        const response =
            await fetch(
                PREDICTION_API
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "Không thể kết nối API dự đoán."
            );

        }


        const result =
            await response.json();


        if (
            !Array.isArray(
                result.predictions
            )
        ) {

            throw new Error(
                "API không trả về danh sách predictions hợp lệ."
            );

        }


        predictionData =
            result.predictions.map(
                product => {

                    const actualPrice =
                        Number(
                            product.current_price_vnd || 0
                        );


                    const predictedPrice =
                        Number(
                            product.predicted_price_vnd || 0
                        );


                    const absoluteError =
                        Number(
                            product.absolute_error_vnd || 0
                        );


                    const percentageError =
                        Number(
                            product.absolute_percentage_error || 0
                        );


                    const smape =
                        Number(
                            product.smape_percent || 0
                        );


                    const apiGroup =
                        String(
                            product.predicted_price_group || ""
                        ).trim();


                    const group =
                        apiGroup !== ""
                            ? apiGroup
                            : getPriceGroup(
                                predictedPrice
                            );


                    return {

                        productId:
                            product.product_id,

                        name:
                            product.product_name,

                        brand:
                            product.brand,

                        category:
                            product.primary_category,

                        actualPrice:
                            actualPrice,

                        predictedPrice:
                            predictedPrice,

                        absoluteError:
                            absoluteError,

                        absolutePercentageError:
                            percentageError,

                        smape:
                            smape,

                        group:
                            group

                    };

                }
            );


        if (
            result.metrics
        ) {

            modelInfo.mae =
                Number(
                    result.metrics.mae ??
                    87918.90
                );


            modelInfo.rmse =
                Number(
                    result.metrics.rmse ??
                    145603.04
                );


            modelInfo.r2 =
                Number(
                    result.metrics.r2 ??
                    0.6524
                );


            modelInfo.mape =
                Number(
                    result.metrics.mape ??
                    43.31527453221777
                );

        }


        if (
            !Number.isFinite(
                modelInfo.mape
            ) ||
            modelInfo.mape === 0
        ) {

            const validErrors =
                predictionData
                    .map(
                        product =>
                            Number(
                                product.absolutePercentageError
                            )
                    )
                    .filter(
                        value =>
                            Number.isFinite(
                                value
                            )
                    );


            if (
                validErrors.length > 0
            ) {

                modelInfo.mape =
                    validErrors.reduce(
                        (
                            total,
                            value
                        ) =>
                            total + value,
                        0
                    ) /
                    validErrors.length;

            }

        }


        if (
            result.thresholds
        ) {

            priceThresholds.q1 =
                Number(
                    result.thresholds.q1_vnd ??
                    169000
                );


            priceThresholds.q2 =
                Number(
                    result.thresholds.q2_vnd ??
                    340000
                );


            predictionData =
                predictionData.map(
                    product => {

                        if (
                            !product.group ||
                            product.group === "undefined"
                        ) {

                            return {

                                ...product,

                                group:
                                    getPriceGroup(
                                        product.predictedPrice
                                    )

                            };

                        }

                        return product;

                    }
                );

        }


        renderKPI();

        renderPredictionChart();

        renderPriceGroups();

        renderPredictionTable();

        renderEvaluation();

        renderInsight();

        setupPriceGroupFilter();


    }

    catch (error) {

        console.error(
            "Lỗi tải dữ liệu dự đoán:",
            error
        );


        if (
            tableBody
        ) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty"
                    >
                        Không thể tải dữ liệu dự đoán.
                        Vui lòng kiểm tra Backend Flask.
                    </td>
                </tr>
            `;

        }

    }

}


document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadPredictionData();

    }
);


function renderKPI() {

    if (
        predictionData.length === 0
    ) {

        return;

    }


    const total =
        predictionData.length;


    const averagePrice =
        predictionData.reduce(
            (
                total,
                product
            ) =>
                total +
                product.predictedPrice,
            0
        ) /
        total;


    const groupCounts = {};


    predictionData.forEach(
        product => {

            if (
                !groupCounts[
                    product.group
                ]
            ) {

                groupCounts[
                    product.group
                ] = 0;

            }


            groupCounts[
                product.group
            ]++;

        }
    );


    const popularGroup =
        Object.entries(
            groupCounts
        ).sort(
            (
                a,
                b
            ) =>
                b[1] - a[1]
        )[0];


    const totalElement =
        document.getElementById(
            "totalPredictions"
        );


    const averageElement =
        document.getElementById(
            "averagePredictedPrice"
        );


    const popularElement =
        document.getElementById(
            "popularPriceGroup"
        );


    const r2Element =
        document.getElementById(
            "r2Score"
        );


    if (
        totalElement
    ) {

        totalElement.textContent =
            total.toLocaleString(
                "vi-VN"
            );

    }


    if (
        averageElement
    ) {

        averageElement.textContent =
            formatCurrency(
                averagePrice
            );

    }


    if (
        popularElement
    ) {

        popularElement.textContent =
            popularGroup
                ? popularGroup[0]
                : "—";

    }


    if (
        r2Element
    ) {

        r2Element.textContent =
            modelInfo.r2.toFixed(4);

    }

}


function renderPredictionChart() {

    const chart =
        document.getElementById(
            "predictionChart"
        );


    if (
        !chart ||
        predictionData.length === 0
    ) {

        return;

    }


    chart.innerHTML = "";


    const chartProducts =
        predictionData.slice(
            0,
            8
        );


    const maxPrice =
        Math.max(
            ...chartProducts.map(
                product =>
                    Math.max(
                        product.actualPrice,
                        product.predictedPrice
                    )
            )
        );


    if (
        !Number.isFinite(maxPrice) ||
        maxPrice <= 0
    ) {

        return;

    }


    if (
        chart.parentElement
    ) {

        const oldLegend =
            chart.parentElement.querySelector(
                ".chart-legend"
            );


        if (
            oldLegend
        ) {

            oldLegend.remove();

        }

    }


    chartProducts.forEach(
        product => {

            const group =
                document.createElement(
                    "div"
                );


            group.className =
                "prediction-group";


            group.style.position =
                "relative";


            group.style.overflow =
                "visible";


            const actualBar =
                document.createElement(
                    "div"
                );


            actualBar.className =
                "prediction-bar actual";


            const predictedBar =
                document.createElement(
                    "div"
                );


            predictedBar.className =
                "prediction-bar predicted";


            actualBar.style.height =
                (
                    product.actualPrice /
                    maxPrice *
                    175
                ) + "px";


            predictedBar.style.height =
                (
                    product.predictedPrice /
                    maxPrice *
                    175
                ) + "px";


            actualBar.title =
                "Giá thực tế: " +
                formatCurrency(
                    product.actualPrice
                );


            predictedBar.title =
                "Giá dự đoán: " +
                formatCurrency(
                    product.predictedPrice
                );


            const productLabel =
                document.createElement(
                    "div"
                );


            productLabel.className =
                "prediction-label";


            productLabel.textContent =
                shortenProductName(
                    product.name,
                    18
                );


            productLabel.title =
                product.name ||
                "Không có tên sản phẩm";


            productLabel.style.position =
                "absolute";


            productLabel.style.left =
                "50%";


            productLabel.style.bottom =
                "-38px";


            productLabel.style.transform =
                "translateX(-50%)";


            productLabel.style.width =
                "125px";


            productLabel.style.textAlign =
                "center";


            productLabel.style.fontSize =
                "10px";


            productLabel.style.lineHeight =
                "13px";


            productLabel.style.color =
                "#6b7280";


            productLabel.style.whiteSpace =
                "normal";


            productLabel.style.overflow =
                "hidden";


            productLabel.style.textOverflow =
                "ellipsis";


            group.appendChild(
                actualBar
            );


            group.appendChild(
                predictedBar
            );


            group.appendChild(
                productLabel
            );


            chart.appendChild(
                group
            );

        }
    );


    chart.style.paddingBottom =
        "55px";


    chart.style.overflow =
        "visible";


    const legend =
        document.createElement(
            "div"
        );


    legend.className =
        "chart-legend";


    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-dot actual"></span>
            Giá thực tế
        </div>

        <div class="legend-item">
            <span class="legend-dot predicted"></span>
            Giá dự đoán
        </div>
    `;


    if (
        chart.parentElement
    ) {

        chart.parentElement.appendChild(
            legend
        );

    }

}


function renderPriceGroups() {

    const container =
        document.getElementById(
            "priceGroupCards"
        );


    if (
        !container ||
        predictionData.length === 0
    ) {

        return;

    }


    const groups = [

        {
            name:
                "Thấp",

            range:
                `≤ ${formatCurrency(
                    priceThresholds.q1
                )}`
        },

        {
            name:
                "Trung bình",

            range:
                `> ${formatCurrency(
                    priceThresholds.q1
                )} – ${formatCurrency(
                    priceThresholds.q2
                )}`
        },

        {
            name:
                "Cao",

            range:
                `> ${formatCurrency(
                    priceThresholds.q2
                )}`
        }

    ];


    container.innerHTML = "";


    groups.forEach(
        group => {

            const count =
                predictionData.filter(
                    product =>
                        product.group ===
                        group.name
                ).length;


            const percent =
                (
                    count /
                    predictionData.length *
                    100
                ).toFixed(1);


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "price-group-card";


            card.innerHTML = `

                <div class="price-group-name">
                    ${group.name}
                </div>

                <div class="price-group-count">
                    ${count.toLocaleString("vi-VN")}
                </div>

                <div class="price-group-percent">
                    ${percent}% dữ liệu test
                </div>

                <div class="price-group-range">
                    ${group.range}
                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

}


function renderPredictionTable(
    selectedGroup = ""
) {

    const tableBody =
        document.getElementById(
            "predictionTableBody"
        );


    if (
        !tableBody
    ) {

        return;

    }


    let products =
        [...predictionData];


    if (
        selectedGroup !== ""
    ) {

        products =
            products.filter(
                product =>
                    product.group ===
                    selectedGroup
            );

    }


    if (
        products.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty"
                >
                    Không có sản phẩm
                    thuộc nhóm giá này.
                </td>
            </tr>
        `;

        return;

    }


    tableBody.innerHTML =
        products
            .map(
                (
                    product,
                    index
                ) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>

                            <div class="product-name">
                                ${escapeHTML(
                                    product.name
                                )}
                            </div>

                        </td>

                        <td>

                            <div class="brand-name">
                                ${escapeHTML(
                                    product.brand
                                )}
                            </div>

                        </td>

                        <td>

                            <span class="actual-price">
                                ${formatCurrency(
                                    product.actualPrice
                                )}
                            </span>

                        </td>

                        <td>

                            <span class="predicted-price">
                                ${formatCurrency(
                                    product.predictedPrice
                                )}
                            </span>

                        </td>

                        <td>

                            <span class="error-value">
                                ${formatCurrency(
                                    product.absoluteError
                                )}
                            </span>

                        </td>

                        <td>

                            <span class="price-badge">
                                ${escapeHTML(
                                    product.group
                                )}
                            </span>

                        </td>

                    </tr>

                `
            )
            .join("");

}


function setupPriceGroupFilter() {

    const filter =
        document.getElementById(
            "priceGroupFilter"
        );


    if (
        !filter
    ) {

        return;

    }


    [
        ...filter.options
    ].forEach(
        option => {

            if (
                option.value ===
                "Cao cấp"
            ) {

                option.remove();

            }

        }
    );


    filter.onchange =
        function () {

            renderPredictionTable(
                filter.value
            );

        };

}


function renderEvaluation() {

    const maeElement =
        document.getElementById(
            "maeValue"
        );


    const rmseElement =
        document.getElementById(
            "rmseValue"
        );


    const r2Element =
        document.getElementById(
            "evaluationR2"
        );


    const mapeElement =
        document.getElementById(
            "mapeValue"
        );


    if (
        maeElement
    ) {

        maeElement.textContent =
            formatCurrency(
                modelInfo.mae
            );

    }


    if (
        rmseElement
    ) {

        rmseElement.textContent =
            formatCurrency(
                modelInfo.rmse
            );

    }


    if (
        r2Element
    ) {

        r2Element.textContent =
            modelInfo.r2.toFixed(4);

    }


    if (
        mapeElement
    ) {

        mapeElement.textContent =
            modelInfo.mape.toFixed(2) +
            "%";

    }

}


function renderInsight() {

    const insight =
        document.getElementById(
            "predictionInsight"
        );


    if (
        !insight ||
        predictionData.length === 0
    ) {

        return;

    }


    const averageActual =
        predictionData.reduce(
            (
                total,
                product
            ) =>
                total +
                product.actualPrice,
            0
        ) /
        predictionData.length;


    const averagePredicted =
        predictionData.reduce(
            (
                total,
                product
            ) =>
                total +
                product.predictedPrice,
            0
        ) /
        predictionData.length;


    const averageDifference =
        Math.abs(
            averagePredicted -
            averageActual
        );


    const groupCounts = {};


    predictionData.forEach(
        product => {

            groupCounts[
                product.group
            ] =
                (
                    groupCounts[
                        product.group
                    ] || 0
                ) + 1;

        }
    );


    const popularGroup =
        Object.entries(
            groupCounts
        ).sort(
            (
                a,
                b
            ) =>
                b[1] - a[1]
        )[0];


    const popularPercent =
        popularGroup
            ? (
                popularGroup[1] /
                predictionData.length *
                100
            ).toFixed(1)
            : "0.0";


    const bestPriceBand =
        getBestPriceBand();


    insight.innerHTML = `

        <div class="insight-item">

            <span class="insight-dot"></span>

            <span>

                Tập test gồm

                <strong>
                    ${predictionData.length.toLocaleString("vi-VN")}
                </strong>

                sản phẩm.

                Giá thực tế trung bình là

                <strong>
                    ${formatCurrency(
                        averageActual
                    )}
                </strong>,

                trong khi giá dự đoán trung bình là

                <strong>
                    ${formatCurrency(
                        averagePredicted
                    )}
                </strong>.

            </span>

        </div>


        <div class="insight-item">

            <span class="insight-dot"></span>

            <span>

                Nhóm giá dự đoán phổ biến nhất là

                <strong>
                    ${
                        popularGroup
                            ? popularGroup[0]
                            : "—"
                    }
                </strong>,

                chiếm

                <strong>
                    ${popularPercent}%
                </strong>

                tập test.

            </span>

        </div>


        <div class="insight-item">

            <span class="insight-dot"></span>

            <span>

                Sai lệch tuyệt đối trung bình giữa
                giá thực tế và giá dự đoán là

                <strong>
                    ${formatCurrency(
                        modelInfo.mae
                    )}
                </strong>.

                Chênh lệch giữa hai mức giá trung bình
                là khoảng

                <strong>
                    ${formatCurrency(
                        averageDifference
                    )}
                </strong>.

            </span>

        </div>


        <div class="insight-item">

            <span class="insight-dot"></span>

            <span>

                Theo phân tích sai số theo khoảng giá,
                nhóm

                <strong>
                    ${bestPriceBand.name}
                </strong>

                có MAE thấp nhất,
                khoảng

                <strong>
                    ${formatCurrency(
                        bestPriceBand.mae
                    )}
                </strong>.

            </span>

        </div>


        <div class="insight-item">

            <span class="insight-dot"></span>

            <span>

                Kết quả đánh giá mô hình:

                <strong>
                    MAE ${formatCurrency(
                        modelInfo.mae
                    )}
                </strong>,

                <strong>
                    RMSE ${formatCurrency(
                        modelInfo.rmse
                    )}
                </strong>

                và

                <strong>
                    R² = ${modelInfo.r2.toFixed(4)}
                </strong>.

                MAPE:

                <strong>
                    ${modelInfo.mape.toFixed(2)}%
                </strong>.

            </span>

        </div>

    `;

}


function getBestPriceBand() {

    if (
        predictionData.length === 0
    ) {

        return {

            name:
                "Không xác định",

            mae:
                0

        };

    }


    const bands = [

        {
            name:
                "Dưới 200.000đ",

            min:
                0,

            max:
                199999
        },


        {
            name:
                "200.000đ – 500.000đ",

            min:
                200000,

            max:
                499999
        },


        {
            name:
                "500.000đ – 1.000.000đ",

            min:
                500000,

            max:
                999999
        },


        {
            name:
                "Từ 1.000.000đ",

            min:
                1000000,

            max:
                Infinity
        }

    ];


    const results =
        bands.map(
            band => {

                const rows =
                    predictionData.filter(
                        product =>
                            product.actualPrice >=
                                band.min &&

                            product.actualPrice <=
                                band.max
                    );


                if (
                    rows.length === 0
                ) {

                    return {

                        name:
                            band.name,

                        mae:
                            Infinity

                    };

                }


                const mae =
                    rows.reduce(
                        (
                            total,
                            product
                        ) =>
                            total +
                            product.absoluteError,
                        0
                    ) /
                    rows.length;


                return {

                    name:
                        band.name,

                    mae:
                        mae

                };

            }
        );


    return results.reduce(
        (
            best,
            current
        ) =>
            current.mae <
            best.mae
                ? current
                : best
    );

}