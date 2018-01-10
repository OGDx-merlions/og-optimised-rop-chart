(function() {
  Polymer({

    is: 'og-optimised-rop-chart',

    properties: {
      /**
      * Width of the Chart.
      *
      * @property width
      */
      width: {
				type: Number,
				value: 960
      },
      /**
      * Height of the Chart.
      *
      * @property height
      */
			height: {
				type: Number,
				value: 300
      },
      /**
      * Margin of the Chart.
      Eg: {top: 20, right: 20, bottom: 30, left: 50}
      *
      * @property margin
      */
      margin: {
				type: Object,
				value() {
					return {top: 20, right: 20, bottom: 30, left: 50};
				},
				observer: '_redraw'
			},
      /**
      * Chart Data
      * Format: {"current": {"x": [1,2,3], "optimised": [1,2,3], "actual": [2,4,5]}, 
        "forecast": {"x": [1,2,3], "recommended": [1,2,3]}
      * @property data
      */
      data: {
				type: Object,
				observer: '_redraw'
      },
      /**
       * Axis Data
       *
       * @property axisData
       */
      axisData: {
        type: Object,
        notify: true,
        observer: '_redraw'
      },
      /**
       * Legend Alignment
       * Eg: right, left, center
       *
       * @property legendAlignment
       */
      legendAlignment: {
        type: String,
        value: "left"
      },

      currentChartType: {
        type: String,
        value: "line"
      }
    },

    __defaultAxisData: {
        "x": {
          "color": "",
          "axisLabel": "Measured Depth",
          "unit": "",
          "tickFormat": "",
          "tickTimeFormat": "",
          "hideGrid": true,
          "d3NiceType": "",
          "niceTicks": 0,
          "start": 0,
          "axisColor": "#c1c0c0",
          "tickColor": "#c1c0c0"
        },
        "y": {
          "hideGrid": false,
          "axisLabel": "Rate of Penetration",
          "axisColor": "#c1c0c0",
          "tickColor": "#c1c0c0",
          "niceTicks": 6,
          "tickFormat": "",
          "start": 0,
          "dotRadius": 2, 
          "actualRop": {
            "color": "#518bb4",
            "dashArray": "",
            "radius": 4,
            "circleStroke": "#518bb4",
            "legendLabel": "Actual ROP",
            "unit": "ft/hr",
            "interpolation": ""
          },
          "optimisedRop": {
            "color": "#f05c56",
            "dashArray": "",
            "legendLabel": "Optimized ROP",
            "unit": "ft/hr",
            "interpolation": ""
          },
          "recommendedRop": {
            "color": "#f05c56",
            "dashArray": "2,2",
            "unit": "ft/hr",
            "legendLabel": "Recommended ROP",
            "interpolation": ""
          },
          "currentDepth": {
            "color": "#c1c0c0",
            "dashArray": "",
            "unit": "ft",
            "legendLabel": "Current Depth"
          }
        }
    },

    ready() {
      this.scopeSubtree(this.$.chart, true);
    },

    attached() {
      this._setupDefaults();
      if(this.data && this.data.length) {
        this.draw();
      }
    },

    draw() {
      let d3 = Px.d3, data = this.data;
      if(!data || !this.axisData || !this.axisData.x || !this.axisData.y) {return;}
      this._prepareChartingArea();
      this._prepareAxes(data);
      this._drawGridLines(data);
      this._drawAxes(data);
      this._drawCurrentDepthSeparator(data);
      this._drawChart(data);

      this.fire("chart-drawn", {});
    },
    
    _setupDefaults() {
      this.axisData = this.axisData ? this.axisData : this.__defaultAxisData;
      this.axisData.x = this.axisData.x ? this.axisData.x : this.__defaultAxisData.x;
      this.axisData.y = this.axisData.y ? this.axisData.y : this.__defaultAxisData.y;

      if(this.axisData.x.axisColor) {
        this.customStyle['--x-axis-color'] = this.axisData.x.axisColor;
      }
      if(this.axisData.x.tickColor) {
        this.customStyle['--x-tick-color'] = this.axisData.x.tickColor;
      }
      if(this.axisData.y.axisColor) {
        this.customStyle['--y-axis-color'] = this.axisData.y.axisColor;
      }
      if(this.axisData.y.tickColor) {
        this.customStyle['--y-tick-color'] = this.axisData.y.tickColor;
      }
      this.updateStyles();
    },

    _prepareChartingArea() {
      let d3 = Px.d3;
      // set the dimensions and margins of the graph
      this.margin = this.margin || {top: 30, right: 20, bottom: 40, left: 50},
      this.adjustedWidth = this.width - this.margin.left - this.margin.right,
      this.adjustedHeight = this.height - this.margin.top - this.margin.bottom;

      d3.select(this.$.chart).select("svg").remove();
      this.svg = d3.select(this.$.chart).append("svg")
          .attr("viewBox", "0 0 "+this.width+" "+this.height)
          .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
          .attr("transform",
                "translate(" + this.margin.left + "," + this.margin.top + ")");

      this.toolTip = d3.tip(d3.select(this.$.chart))
        .attr("class", "d3-tip")
        .offset([-8, 0])
        .html(function(d) {
          return d.msg;
        });

      this.svg.call(this.toolTip);
    },
    _prepareAxes(data) {
      // set the ranges
      let d3 = Px.d3;
      this.x= d3.scaleLinear().range([0, this.adjustedWidth]);
      this.y = d3.scaleLinear().range([this.adjustedHeight, 0]).clamp(true);

      let x = this.x, y = this.y;

      let allX = [...data.current.x, ...data.forecast.x];
      let allY = [...data.current.optimised, 
          ...data.current.actual, ...data.forecast.recommended];

      x.domain(this.axisData.x.start ? [this.axisData.x.start, d3.extent(allX)[1]] : d3.extent(allX));
      y.domain(this.axisData.y.start ? [this.axisData.y.start, d3.extent(allY)[1]] : d3.extent(allY));

      if(this.axisData.x.niceTicks) {
        x.nice(this.axisData.x.niceTicks);
      } else {
        x.nice();
      }
      if(this.axisData.y.niceTicks) {
        y.nice(this.axisData.y.niceTicks);
      }
    },
    _drawGridLines(data) {
      let x = this.x, y = this.y, d3 = Px.d3;
      let yScaledMin = y(y.domain()[0]);
      if(!this.axisData.x.hideGrid) {
        this.svg.append("g")
          .attr("class", "grid x-grid")
          .call(d3.axisBottom(x)
              .ticks(this.axisData.x.totalGridLines || 5)
              .tickSize(this.adjustedHeight)
              .tickFormat(""));
      }

      if(!this.axisData.y.hideGrid) {
        this.svg.append("g")
          .attr("class", "grid y-grid")
          .call(d3.axisLeft(y)
              .ticks(this.axisData.y.totalGridLines || 5)
              .tickSize(-this.adjustedWidth)
              .tickFormat(""));
      }
    },
    _drawCurrentDepthSeparator(data) {
      let x = this.x, y = this.y, d3 = Px.d3;
      let currentDepth = data.forecast.x[0],
      _axisData = this.axisData.y.currentDepth;
      this.svg.append("svg:line")
        .attr("class", "current-depth")
        .style("stroke", _axisData.color || this.axisData.y.axisColor)
        .style("stroke-dasharray", _axisData.dashArray || "2,2")
        .attr("x1", x(currentDepth))
        .attr("y1", this.adjustedHeight+18)
        .attr("x2", x(currentDepth))
        .attr("y2", -7);
    },
    _drawChart(data) {
      this._plotActual(data);
      this._plotOptimized(data);
      this._plotRecommended(data);
    },
    _plotActual(data) {
      let x = this.x, y = this.y, d3 = Px.d3;
      
      let actualRadius = 2, _axisData = this.axisData.y.actualRop;
      if(_axisData.radius !== 0) {
        actualRadius = _axisData.radius || 2;
      }

      let _data = [];
      data.current.x.forEach((pt, idx) => {
        _data.push([+pt, +data.current.actual[idx]])
      });

      this.svg.selectAll(".dot")
        .data(_data)
        .enter()
          .append("circle")
          .attr("r", actualRadius)
          .attr("cx", (d, i) => x(d[0]))
          .attr("cy", (d) => y(d[1]))
          .style("stroke", _axisData.circleStroke || _axisData.color || "steelblue")
          .style("display", "none")
          .attr("fill", _axisData.color || "steelblue")
          .attr("class", "series-actual actual-scatter");

      this._plotLineAndDot(_axisData, _data, 'actual');
    },
    _plotOptimized(data) {
      let x = this.x, y = this.y, d3 = Px.d3;
      
      let _axisData = this.axisData.y.optimisedRop;
      let _data = [];
      data.current.x.forEach((pt, idx) => {
        _data.push([+pt, +data.current.optimised[idx]])
      });
      this._plotLineAndDot(_axisData, _data, 'optimised');
    },
    _plotRecommended(data) {
      let x = this.x, y = this.y, d3 = Px.d3;
      
      let _axisData = this.axisData.y.recommendedRop;
      let _data = [];
      data.forecast.x.forEach((pt, idx) => {
        _data.push([+pt, +data.forecast.recommended[idx]])
      });
      this._plotLineAndDot(_axisData, _data, 'recommended');
    },
    _plotLineAndDot(_axisData, data, name) {
      let x = this.x, y = this.y, d3 = Px.d3, radius = this.axisData.y.dotRadius;
      let line = d3.line()
          .x(function(d) { return x(d[0]); })
          .y(function(d) { return y(d[1]); });

      if(_axisData.interpolation) {
        line.curve(d3[_axisData.interpolation]);
      }

      this.svg.append("path")
        .datum(data)
        .attr("class", `series-${name} ${name}-line`)
        .style("stroke", _axisData.color || "steelblue")
        .style("stroke-dasharray", _axisData.dashArray || "0,0")
        .attr("fill", "transparent")
        .attr("d", line)
        .style("pointer-events", "none");

      this.svg.selectAll(".dot")
        .data(data)
        .enter()
          .append("circle")
          .attr("r", radius)
          .attr("cx", (d, i) => x(d[0]))
          .attr("cy", (d) => y(d[1]))
          .attr("fill", _axisData.color || "steelblue")
          .attr("class", `series-${name}`)
          .on('mouseover', (d, i) => {
            d3.select(this)
              .attr('r', radius + 2);
            let prefix = _axisData.label ? _axisData.label + ": " : "";
            d.msg = prefix + d[1];
            this.toolTip.show(d);
          })
          .on('mouseout', (d) => {
            d3.select(this)
              .attr('r', radius);
            this.toolTip.hide(d);
          });
    },
    _drawAxes(data) {
      let x = this.x, y = this.y, d3 = Px.d3;

      // Add the X Axis
      let _xAxis = d3.axisBottom(x);
      _xAxis.tickFormat(d3.format(this.axisData.x.tickFormat));

      this.svg.append("g")
          .attr("transform", "translate(0," + this.adjustedHeight + ")")
          .attr("class", "x-axis")
          .call(_xAxis);

      // Add the Y Axis
      let _yAxis = d3.axisLeft(y).ticks(this.axisData.y.niceTicks || 6);
      if(this.axisData.y.tickFormat) {
        _yAxis.tickFormat(d3.format(this.axisData.y.tickFormat));
      }
      this.svg.append("g")
          .attr("class", "y-axis")
          .call(_yAxis);

      if(this.axisData.y.axisLabel) {
        this.svg.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 0 - this.margin.left)
          .attr("x",0 - (this.adjustedHeight / 2))
          .attr("dy", "1em")
          .attr("class", "y-axis-label")
          .text(this.axisData.y.axisLabel);
      }

      if(this.axisData.x.axisLabel) {
        this.svg.append("text")
          .attr("dy", "1em")
          .attr("class", "x-axis-label")
          .attr("text-anchor", "middle")
          .attr("transform", "translate("+ 
            (this.adjustedWidth/2) +","+(this.adjustedHeight + this.margin.top)+")")
          .text(this.axisData.x.axisLabel);
      }
    },

    _redraw(newData, oldData) {
      Px.d3.select(this.$.chart).select("svg").remove();
      this.draw();
    },

    _toggleSeries(event) {
      const label = "series-" + event.target.dataset.id;

      this[label] = !this[label];
			if(this[label]) {
				this.querySelectorAll("."+label).forEach((elt) => {
					elt.style.display = "none";
				});
			} else {
				this.querySelectorAll("."+label).forEach((elt) => {
					elt.style.display = "block";
				});
			}
    },

    _toggleChartType() {
      this.currentChartType = this.currentChartType === 'line' ? 'scatter' : 'line';
      if(this.currentChartType === 'scatter') {
        this.querySelectorAll(".actual-line").forEach((elt) => {
					elt.style.display = "none";
        });
        this.querySelectorAll(".actual-scatter").forEach((elt) => {
					elt.style.display = "block";
				});
      } else {
        this.querySelectorAll(".actual-line").forEach((elt) => {
					elt.style.display = "block";
        });
        this.querySelectorAll(".actual-scatter").forEach((elt) => {
					elt.style.display = "none";
				});
      }
    },

    _hideChartTypeIcon(type, currentChartType) {
      currentChartType = currentChartType || 'line';
      return type == currentChartType;
    }
  });
})();
