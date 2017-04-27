const papa      = require("papaparse");
const mapKeys   = require("lodash").mapKeys;
const mapValues = require("lodash").mapValues;
const omit      = require("lodash").omit;
const omitBy    = require("lodash").omitBy;
const logger    = require("./logger").getLogger();


const formatMonth = (date) => {
    const pad = (num, size) => {
        var s = num+"";
        while (s.length < size) s = "0" + s;
        return s;
    };

    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1, 2)}`
};

const extractMetricsFromCsv = (csv) => {
    // Strip empty line at the end, in order to avoid a parsing error
    csv = csv.trim();

    // Parse CSV
    let result = papa.parse(csv, { delimiter: ",", header: true, fastMode: true });

    // Log if an error occurred
    if (result.errors && result.errors.length > 0) {
        result.errors.forEach((err) => {
            logger.warn(`Ignoring error occurred while parsing csv from file ${object}: ${err.message}`);
        });
    }

    // Transform column names into metric names
    let rows = result.data.map((row) => {
        return mapKeys(row, (value, key) => {
            return key.replace(/ /g, "_").toLowerCase();
        });
    });

    // Index by date
    rows = mapKeys(rows, (row, key) => {
        return row.date;
    });

    // Filter out unwanted data
    rows = mapValues(rows, (row) => {
        return omit(row, [ "date" ]);
    });

    // Remove N/A values
    rows = mapValues(rows, (row) => {
        return omitBy(row, (value) => value === "NA");
    });

    return rows;
};


module.exports = {
    formatMonth:           formatMonth,
    extractMetricsFromCsv: extractMetricsFromCsv
};
