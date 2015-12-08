var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

function run () {
  // -- Init Viz 2 -- //
  getData("/data/causeOfDeath.json", (d) => {
    const eduCauseData = new Data(d);

    // Filter out all Not Specified values (for any key)
    eduCauseData.addPipe((rawData) => {
      return _.reject(rawData, datum => _.contains(datum, "Not Specified"));
    });

    // Filter out all No Formal Education values (for any key)
    eduCauseData.addPipe((rawData) => {
      return _.reject(rawData, datum => _.contains(datum, "No Formal Education"));
    });

    // Filter out all Not Started values (for any key)
    eduCauseData.addPipe((rawData) => {
      return _.reject(rawData, datum => _.contains(datum, "Not Started"));
    });

    // Group specific cause of death into categories
    // EG. All malignant neoplasm deaths -> Cancer
    eduCauseData.addNamedPipe("Cancer", (rawData) => {
      return relabelData(rawData, "Cause of Death", GROUPINGS["Cause - Cancer"]);
    });

    eduCauseData.addNamedPipe("Cardiovascular", (rawData) => {
      return relabelData(rawData, "Cause of Death", GROUPINGS["Cause - Cardiovascular"]);
    });


    // Group educational attainments
    eduCauseData.addNamedPipe("Elementary", (rawData) => {
      return relabelData(rawData, "Education", GROUPINGS["Education - Elementary"]);
    });

    eduCauseData.addNamedPipe("High School", (rawData) => {
      return relabelData(rawData, "Education", GROUPINGS["Education - High School"]);
    });

    eduCauseData.addNamedPipe("College", (rawData) => {
      return relabelData(rawData, "Education", GROUPINGS["Education - College"]);
    });

    // Construct a matrix from the data
    let eduCauseMatrix = new Matrix(
      eduCauseData.runPipeline(),
      "Education",
      "Cause of Death"
    );

    // Normalize matrix by educational attainment
    eduCauseMatrix.normalizeByRow();

    // Construct a view for the matrix
    eduCauseMatrix.bubbleView("#viz2");

    // Handle year switching
    $('input[name=yearselect]').change((e) => {
      const year = event.target.value;

      if (year === "all") eduCauseData.removeNamedPipe("year");
      else {
        eduCauseData.addNamedPipe("year", (rawData) => {
          return _.filter(rawData, datum => datum.Year === parseInt(year));
        });
      }

      // Regenerate Matrix & Viz
      regenerateVizTwo(eduCauseData.runPipeline());
    });

    // Handle Cause Drilldown
    $('input[name=causeselect]').change((e) => {
      console.log(e.target)
      const pipeName = event.target.value;
      const addPipe = !event.target.checked;

      if (!addPipe) eduCauseData.removeNamedPipe(pipeName);
      else {
        eduCauseData.addNamedPipe(pipeName, (rawData) => {
          return relabelData(rawData, "Cause of Death", GROUPINGS["Cause - " + pipeName]);
        });
      }

      // Regenerate Matrix & Viz
      regenerateVizTwo(eduCauseData.runPipeline());
    });

    // Handle Education Drilldown
    $('input[name=educationselect]').change((e) => {
      const pipeName = event.target.value;
      const addPipe = !event.target.checked;

      if (!addPipe) eduCauseData.removeNamedPipe(pipeName);
      else {
        eduCauseData.addNamedPipe(pipeName, (rawData) => {
          return relabelData(rawData, "Education", GROUPINGS["Education - " + pipeName]);
        });
      }

      // Regenerate Matrix & Viz
      regenerateVizTwo(eduCauseData.runPipeline());
    });
  });
}

function regenerateVizTwo(data) {
  const viz2 = new Matrix(
    data,
    "Education",
    "Cause of Death"
  );
  viz2.normalizeByRow();
  viz2.bubbleView("#viz2");
}

function getData (endpoint, f) {
  d3.json(endpoint, function(error,data) {
     if (error) {
         console.log(error);
     } else {
         f(data);
     }
  });
}

function getDataRows (data, parameter, value) {
  return data.filter(function(row){
    return (row[parameter]===value)
  })
}

function Data(rawData) {
  this.rawData = rawData;
  this.pipeline = [];
  this.namedPipes = {};
}

Data.prototype.addPipe = function(pipe) {
  this.pipeline.push(pipe);
}

Data.prototype.addNamedPipe = function(name, pipe) {
  this.namedPipes[name] = pipe;
}

Data.prototype.removeNamedPipe = function(name) {
  if (name in this.namedPipes) delete this.namedPipes[name];
}

Data.prototype.runPipeline = function () {
  // Deep copy the rawData
  let transformedData = JSON.parse(JSON.stringify(this.rawData));

  this.pipeline.forEach((pipe) => {
    transformedData = pipe(transformedData);
  });

  _.each(this.namedPipes, (pipe) => {
    transformedData = pipe(transformedData);
  });

  return transformedData;
}

function relabelData(data, key, grouping={}) {
  return data.map((datum) => {
    _.each(grouping, (membersOfGroup, groupName) => {
      if (membersOfGroup.indexOf(datum[key]) != -1) datum[key] = groupName;
    })

    return datum;
  });
}



/**
 * Matrix
 * ------
 *
 * A 'class' for organizing data into a 2D format for visualization.
 *
 * The Matrix format takes an array of SQL row-like data and condenses
 * it based on two properties - one for rows and one for columns.
 */


/**
 * Condense all of the data by two properties, the rowAxisKey
 * and colAxisKey. Construct a matrix out of the results
 *
 * @param  {Array} data The SQL-row-style data
 * @param  {String} rowAxisKey The key by which to group data by row
 * @param  {String} colAxisKey The key by which to group data by column
 */
function Matrix (data, rowAxisKey, colAxisKey) {
  this.rowLabels = _.uniq(_.pluck(data, rowAxisKey));
  this.colLabels = _.uniq(_.pluck(data, colAxisKey));

  // Create a 2D Matrix with the axes specified. At each
  // index, store an object with all of the data that match
  // those two axis and the sum of the number of people that
  // match that axis
  this.matrix = new Array(this.rowLabels.length);
  for (let row = 0; row < this.rowLabels.length; row++) {
    this.matrix[row] = new Array(this.rowLabels.length);
    this.colLabels.forEach((label, col) => {
      this.matrix[row][col] = {
        row,
        col,
        rowLabel: this.rowLabels[row],
        colLabel: this.colLabels[col],
        size: 0,
        data: [],
      }
    })
  }

  // Assign all of the data to the points at which
  // they belong
  let row, col;
  data.forEach((datum) => {
    row = this.rowLabels.indexOf(datum[rowAxisKey]);
    col = this.colLabels.indexOf(datum[colAxisKey]);

    this.matrix[row][col].data.push(datum);
    this.matrix[row][col].size += datum["Number in Group"];
  });
}

/**
 * Normalize the 'size' attribute of each element in the matrix
 * so that it represents a ratio of the total data in its column.
 */
Matrix.prototype.normalizeByColumn = function () {
  for (let col = 0; col < this.colLabels.length; col++ ) {
    let colTotal = 0;

    // Total column
    for (let row = 0; row < this.rowLabels.length; row++ ) {
      this.matrix[row][col].size = this.totalData(row, col);
      colTotal += this.matrix[row][col].size;
    }

    // Normalize each 'size' value in column by total
    for (let row = 0; row < this.rowLabels.length; row++) {
      this.matrix[row][col].size /= colTotal;
    }
  }
}

/**
 * Normalize the 'size' attribute of each element in the matrix
 * so that it represents a ratio of the total data in its row.
 */
Matrix.prototype.normalizeByRow = function () {
  for (let row = 0; row < this.rowLabels.length; row++ ) {
    let rowTotal = 0;

    // Total column
    for (let col = 0; col < this.colLabels.length; col++ ) {
      this.matrix[row][col].size = this.totalData(row, col);
      rowTotal += this.matrix[row][col].size;
    }

    // Normalize each 'size' value in column by total
    for (let col = 0; col < this.colLabels.length; col++) {
      this.matrix[row][col].size /= rowTotal;
    }
  }
}

/**
 * Total all of the data elements at a certain point in the matrix.
 *
 * @param  {Number} row The row index of the point to total
 * @param  {Number} col The column index of the point to total
 * @return {Number}     The number of people represented by that matrix point
 */
Matrix.prototype.totalData = function (row, col) {
  let total = 0;

  this.matrix[row][col].data.forEach((datum) => {
    total += datum["Number in Group"];
  })

  return total;
}

/**
 * Project a view of the matrix into an SVG.
 *
 * @param  {String} selector A d3 selector referring to an svg
 */
Matrix.prototype.bubbleView = function (selector) {
  // Define View Variables
  const root = d3.select(selector);
  root.selectAll("*").remove();
  const SVG_PADDING = 50;

  const width = parseInt(root.style("width")) - SVG_PADDING;
  const height = parseInt(root.style("height")) - SVG_PADDING;

  const MARGIN_INDICIES = 4;
  const elemWidth = width / (this.colLabels.length + MARGIN_INDICIES);
  const elemHeight = height / (this.rowLabels.length + MARGIN_INDICIES);
  const maxRadius = Math.min(elemWidth, elemHeight);

  // Position and Create Row Labels
  const rowLabels = root.append("g");
  this.rowLabels.forEach((label, index) => {
    let x = 10;
    let y = elemHeight * (index) + maxRadius;

    rowLabels.append("text")
      .text(label)
      .attr({
        x,
        y: y - 5,
      })
      .style({
        "text-transform": "capitalize",
      });

    rowLabels.append("line")
      .attr({
        x1: 10,
        x2: width - 10,
        y1: y,
        y2: y,
      })
      .style({
        "stroke-width": "1px",
        "stroke-opacity": "0.1",
        "stroke": "black",
      });
  });

  // Position and Create Column Labels
  const colLabels = root.append("g");
  this.colLabels.forEach((label, index) => {
    let x = elemWidth * (MARGIN_INDICIES + index) + SVG_PADDING/2;
    let y = elemHeight * (this.rowLabels.length) + maxRadius;

    colLabels.append("text")
      .text(label)
      .attr({
        x: x + 5,
        y,
        "transform": `rotate(30 ${x} ${y})`,
      })
      .style({
        "text-transform": "capitalize",
      });

    colLabels.append("line")
      .attr({
        x1: x,
        x2: x,
        y1: 10,
        y2: y,
      })
      .style({
        "stroke-width": "1px",
        "stroke-opacity": "0.1",
        "stroke": "black",
      })
  });

  // Render Data as Circles
  const circles = root.append("g");
  this.rowLabels.forEach((r, rowIndex) => {
    this.colLabels.forEach((c, colIndex) => {
      circles.append("circle")
        .attr({
          cx: elemWidth * (colIndex + MARGIN_INDICIES) + SVG_PADDING/2,
          cy: elemHeight * (rowIndex) + maxRadius,
          r: Math.sqrt(this.matrix[rowIndex][colIndex].size / Math.PI) * maxRadius,
          "fill": "rgb(85, 85, 85)",
        })
        .on("mouseover", (e) => {
          const tooltip = d3.select(".tooltip")
          tooltip.transition()
           .duration(200)
           .style("opacity", .9)
           .style("background-color","#EEE")
           .style("fill", "none")
           .style("stroke", "#fff")
           .style("stroke-width", 6)
           .style("border-radius", "10")
           .style("padding", "10");
           const d = this.matrix[rowIndex][colIndex];
            // content
            tooltip.html(
              `<center> ${d.colLabel} <br/>
               ${(d.size * 100).toFixed(1)}% of Deaths of Persons <br/>
               with Highest Educational Status </br>
               ${d.rowLabel} </center>`)
             .style("left", (d3.event.pageX + 5) + "px")
             .style("top", (d3.event.pageY - 28) + "px");

        }).on("mouseout", () => {
          d3.select(".tooltip")
            .transition()
            .duration(500)
            .style("opacity", 0);
        });
    });
  });
}

const GROUPINGS = {
  "Cause of Death": {
    "Cancer": [
      "Malignant Neoplasm Unspecified",
      "Malignant Neoplasm of Stomach",
      "Malignant Neoplasm of Colon or Rectum or Anus",
      "Malignant Neoplasm of Pancreas",
      "Malignant Neoplasm of Trachea or Bronchus or Lung",
      "Malignant Neoplasm of Breast",
      "Malignant Neoplasm of Cervix or Uteri or Corpus Uteri or Ovary",
      "Malignant Neoplasm of Prostate",
      "Malignant Neoplasm of Urinary Tract",
      "Non Hodgkins Lymphoma",
      "Leukemia",
      "Other Malignant Neoplasms",
    ],

    "Cardiovascular Disease": [
      "Diseases of Heart",
      "Hypertensive Heart Disease with or without Renal Disease",
      "Ischemic Heart Diseases",
      "Other Diseases of Heart",
      "Essential Primary Hypertension or Hypertensive Renal Disease",
      "Cerebrovascular Diseases",
      "Atherosclerosis",
      "Other Diseases of Circulatory System",
    ],
  },

  "Cause - Cancer": {
    "Cancer": [
      "Malignant Neoplasm Unspecified",
      "Malignant Neoplasm of Stomach",
      "Malignant Neoplasm of Colon or Rectum or Anus",
      "Malignant Neoplasm of Pancreas",
      "Malignant Neoplasm of Trachea or Bronchus or Lung",
      "Malignant Neoplasm of Breast",
      "Malignant Neoplasm of Cervix or Uteri or Corpus Uteri or Ovary",
      "Malignant Neoplasm of Prostate",
      "Malignant Neoplasm of Urinary Tract",
      "Non Hodgkins Lymphoma",
      "Leukemia",
      "Other Malignant Neoplasms",
    ],
  },

  "Cause - Cardiovascular": {
    "Cardiovascular Disease": [
      "Diseases of Heart",
      "Hypertensive Heart Disease with or without Renal Disease",
      "Ischemic Heart Diseases",
      "Other Diseases of Heart",
      "Essential Primary Hypertension or Hypertensive Renal Disease",
      "Cerebrovascular Diseases",
      "Atherosclerosis",
      "Other Diseases of Circulatory System",
    ],
  },

  "Education - Elementary": {
    "Elementary School (1-8)" : [
      "1 Years of Elementary School",
      "2 Years of Elementary School",
      "3 Years of Elementary School",
      "4 Years of Elementary School",
      "5 Years of Elementary School",
      "6 Years of Elementary School",
      "7 Years of Elementary School",
      "8 Years of Elementary School",
    ],
  },

  "Education - High School" : {
    "High School (9-12)": [
      "1 Year of High School",
      "2 Years of High School",
      "3 Years of High School",
      "4 Years of High School",
    ],
  },

  "Education - College": {
    "College": [
      "1 Year of College",
      "2 Years of College",
      "3 Years of College",
      "4 Years of College",
      "5+ Years of College"
    ],
  },

  "Education": {
    "Elementary School (1-8)" : [
      "1 Years of Elementary School",
      "2 Years of Elementary School",
      "3 Years of Elementary School",
      "4 Years of Elementary School",
      "5 Years of Elementary School",
      "6 Years of Elementary School",
      "7 Years of Elementary School",
      "8 Years of Elementary School",
    ],

    "High School (9-12)": [
      "1 Year of High School",
      "2 Years of High School",
      "3 Years of High School",
      "4 Years of High School",
    ],

    "College": [
      "1 Year of College",
      "2 Years of College",
      "3 Years of College",
      "4 Years of College",
    ],
  }
}

run();
