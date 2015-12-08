function lineChart(target, path, grouping=null) {
  // Store svg attributes for easy use
  const margin = {top: 20, right: 50, bottom: 100, left: 50};
  const width = d3.select(target).style("width").replace("px", "") - margin.left - margin.right,
        height = d3.select(target).style("height").replace("px", "") - margin.top - margin.bottom;

  // Create margins on svg
  const svg = d3.select(target).attr({
    width: width + margin.left + margin.right,
    height: height + margin.top + margin.bottom,
  }).append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)

  const colors = d3.scale.category10();

  // Set up axes
  const x = d3.scale.ordinal()
    .rangePoints([0, width], 2);

  const y = d3.scale.linear()
    .range([height, 0]);

  const xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")

  const yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  // Load data and render chart
  d3.json("/data/" + path, (err, data) => {
    if (err) throw err;

    // Split data into groups if a grouping key is specified
    let groups, group;
    if (grouping === null) {
      groups = {
        population: data
      };
    } else {
      groups = {}
      data.forEach((datum) => {
        group = datum[grouping];
        if (group in groups) groups[group].push(datum);
        else groups[group] = [datum]
      });
    }

    // Establish Axes Domains
    x.domain(_.pluck(data, "Education"));
    y.domain([45, 90]);

    svg.append("g")
      .call(xAxis)
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${height})`);

    svg.select(".x")
      .selectAll(".tick")
      .selectAll("text")
      .style("text-anchor", "start")
      .attr("transform", `rotate(30)`)

    svg.append("g")
      .attr("class", "y axis")
      .call(yAxis);

    // Draw Vertical Lines
    svg.selectAll("line")
      .data(data, d => `line: ${d["Education"]}, ${d["Age (Years)"]}`)
      .enter()
      .append("line")
      .attr({
        class: "line",
        x1: d => x(d["Education"]),
        y1: 0,
        x2: d => x(d["Education"]),
        y2: height,
      });

    _.forEach(groups, (groupData, groupName, index) => {
      // Draw Circles
      svg.selectAll("." + groupName)
        .data(groupData, d => `circle: ${d["Education"]}, ${d["Age (Years)"]}`)
        .enter()
        .append("path")
        .attr("class", "." + groupName)
        .attr("class", "circle")
        .attr("transform", d => `translate(${x(d["Education"])}, ${y(d["Age (Years)"])})`)
        .attr("d", d3.svg.symbol())
        .style("fill", colors(groupName));
    });
  });
}

// -- Running Script -- //
lineChart("#viz1", "population.json")
lineChart("#viz3", "sex.json", "Sex")
