// Interactive World Map Application
class WorldMap {
    constructor() {
        this.svg = null;
        this.g = null;
        this.projection = null;
        this.path = null;
        this.zoom = null;
        this.countries = null;
        this.selectedCountry = null;
        this.countryData = {};
        this.tooltip = null;
        this.countryLabel = null;
        this.config = null;
        this.cybersecurityData = {};
        this.complianceCategories = {};
        
        this.init();
    }
    
    async init() {
        this.setupMap();
        this.createTooltip();
        this.createCountryLabel();
        await this.loadConfig();
        await this.loadData();
        this.setupEventListeners();
        this.setupSearch();
    }
    
    setupMap() {
        const container = d3.select("#world-map");
        const containerNode = container.node();
        const width = containerNode.clientWidth;
        const height = containerNode.clientHeight;
        
        // Create SVG
        this.svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);
        
        // Setup projection
        this.projection = d3.geoNaturalEarth1()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);
        
        this.path = d3.geoPath().projection(this.projection);
        
        // Setup zoom
        this.zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                this.g.attr("transform", event.transform);
            });
        
        this.svg.call(this.zoom);
        
        // Add click handler to deselect when clicking on empty area
        this.svg.on("click", (event) => {
            // Only deselect if clicking on the SVG background (not on a country)
            if (event.target === this.svg.node() || event.target.tagName === 'rect') {
                this.deselectCountry();
            }
        });
        
        // Create group for countries
        this.g = this.svg.append("g");
        
        // Add ocean background
        this.svg.insert("rect", ":first-child")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "rgb(51, 51, 51)");
    }
    
    createTooltip() {
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip");
    }
    
    createCountryLabel() {
        this.countryLabel = d3.select("body").append("div")
            .attr("class", "country-label");
    }
    
    async loadConfig() {
        try {
            // Load main config
            const configResponse = await fetch('./config.json');
            this.config = await configResponse.json();
            
            // Load cybersecurity data
            const dataResponse = await fetch(this.config.dataSource || './cybersecurity-data.json');
            const cybersecurityData = await dataResponse.json();
            
            this.cybersecurityData = cybersecurityData.countries || {};
            this.complianceCategories = cybersecurityData.complianceCategories || {};
            
            console.log('Configuration loaded:', this.config);
            console.log('Cybersecurity data loaded for countries:', Object.keys(this.cybersecurityData));
        } catch (error) {
            console.warn('Could not load configuration files, using defaults:', error);
            this.config = {
                settings: {
                    showCountryNames: true,
                    autoZoomOnClick: true,
                    enableSearch: true,
                    showComplianceInTooltip: true
                }
            };
            this.cybersecurityData = {};
            this.complianceCategories = {
                "unknown": {
                    "color": "#9E9E9E",
                    "label": "Unknown",
                    "description": "Compliance status not assessed"
                }
            };
        }
    }
    
    async loadData() {
        try {
            // Show loading message
            const container = d3.select("#world-map");
            container.append("div")
                .attr("class", "loading")
                .text("Loading world map data...");
            
            // Load world map data
            const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
            
            // Remove loading message
            container.select(".loading").remove();
            
            this.countries = topojson.feature(world, world.objects.countries);
            
            // Debug: Log all country names to help with configuration
            console.log("Available country names:");
            this.countries.features.forEach(d => {
                const name = this.getCountryName(d);
                console.log(`"${name}"`);
            });
            
            // Load country information
            await this.loadCountryInfo();
            
            this.drawCountries();
        } catch (error) {
            console.error("Error loading map data:", error);
            d3.select("#world-map").select(".loading")
                .text("Error loading map data. Please refresh the page.");
        }
    }


    
    async loadCountryInfo() {
        // Sample country data - in a real application, you'd load this from an API
        this.countryData = {
            "United States of America": {
                capital: "Washington, D.C.",
                population: "331.9 million",
                area: "9.83 million km²",
                currency: "US Dollar (USD)",
                languages: "English",
                region: "North America"
            },
            "Canada": {
                capital: "Ottawa",
                population: "38.2 million",
                area: "9.98 million km²",
                currency: "Canadian Dollar (CAD)",
                languages: "English, French",
                region: "North America"
            },
            "Brazil": {
                capital: "Brasília",
                population: "215.3 million",
                area: "8.52 million km²",
                currency: "Brazilian Real (BRL)",
                languages: "Portuguese",
                region: "South America"
            },
            "United Kingdom": {
                capital: "London",
                population: "67.3 million",
                area: "243,610 km²",
                currency: "Pound Sterling (GBP)",
                languages: "English",
                region: "Europe"
            },
            "France": {
                capital: "Paris",
                population: "67.8 million",
                area: "643,801 km²",
                currency: "Euro (EUR)",
                languages: "French",
                region: "Europe"
            },
            "Germany": {
                capital: "Berlin",
                population: "83.2 million",
                area: "357,022 km²",
                currency: "Euro (EUR)",
                languages: "German",
                region: "Europe"
            },
            "Italy": {
                capital: "Rome",
                population: "59.1 million",
                area: "301,340 km²",
                currency: "Euro (EUR)",
                languages: "Italian",
                region: "Europe"
            },
            "Spain": {
                capital: "Madrid",
                population: "47.4 million",
                area: "505,370 km²",
                currency: "Euro (EUR)",
                languages: "Spanish",
                region: "Europe"
            },
            "Russia": {
                capital: "Moscow",
                population: "146.2 million",
                area: "17.1 million km²",
                currency: "Russian Ruble (RUB)",
                languages: "Russian",
                region: "Europe/Asia"
            },
            "China": {
                capital: "Beijing",
                population: "1.41 billion",
                area: "9.6 million km²",
                currency: "Chinese Yuan (CNY)",
                languages: "Mandarin Chinese",
                region: "Asia"
            },
            "India": {
                capital: "New Delhi",
                population: "1.38 billion",
                area: "3.29 million km²",
                currency: "Indian Rupee (INR)",
                languages: "Hindi, English",
                region: "Asia"
            },
            "Japan": {
                capital: "Tokyo",
                population: "125.8 million",
                area: "377,975 km²",
                currency: "Japanese Yen (JPY)",
                languages: "Japanese",
                region: "Asia"
            },
            "Australia": {
                capital: "Canberra",
                population: "25.7 million",
                area: "7.69 million km²",
                currency: "Australian Dollar (AUD)",
                languages: "English",
                region: "Oceania"
            },
            "South Africa": {
                capital: "Cape Town, Pretoria, Bloemfontein",
                population: "60.4 million",
                area: "1.22 million km²",
                currency: "South African Rand (ZAR)",
                languages: "11 official languages",
                region: "Africa"
            },
            "Egypt": {
                capital: "Cairo",
                population: "104.3 million",
                area: "1.00 million km²",
                currency: "Egyptian Pound (EGP)",
                languages: "Arabic",
                region: "Africa"
            },
            "Nigeria": {
                capital: "Abuja",
                population: "218.5 million",
                area: "923,768 km²",
                currency: "Nigerian Naira (NGN)",
                languages: "English",
                region: "Africa"
            },
            "Mexico": {
                capital: "Mexico City",
                population: "128.9 million",
                area: "1.96 million km²",
                currency: "Mexican Peso (MXN)",
                languages: "Spanish",
                region: "North America"
            },
            "Argentina": {
                capital: "Buenos Aires",
                population: "45.4 million",
                area: "2.78 million km²",
                currency: "Argentine Peso (ARS)",
                languages: "Spanish",
                region: "South America"
            }
        };
    }
    
    drawCountries() {
        this.g.selectAll(".country")
            .data(this.countries.features)
            .enter().append("path")
            .attr("class", d => {
                const countryName = this.getCountryName(d);
                const data = this.getCybersecurityData(countryName);
                let classes = "country";
                if (data) {
                    classes += ` compliance-${data.complianceStatus}`;
                    console.log(`Country with data: ${countryName} - Status: ${data.complianceStatus}`);
                } else {
                    classes += " compliance-unknown";
                }
                return classes;
            })
            .attr("d", this.path)
            .style("fill", d => {
                const countryName = this.getCountryName(d);
                return this.getCountryColor(countryName);
            })
            .on("mouseover", (event, d) => this.onCountryHover(event, d))
            .on("mouseout", () => this.onCountryHoverOut())
            .on("click", (event, d) => this.onCountryClick(event, d));
    }
    

    

    
    getCountryName(d) {
        // Try different property names that might contain the country name
        return d.properties.NAME || 
               d.properties.NAME_EN || 
               d.properties.NAME_LONG || 
               d.properties.ADMIN ||
               d.properties.sovereignt ||
               d.properties.name ||
               "Unknown";
    }


    // Get cybersecurity data for a country (handles name variations)
    getCybersecurityData(countryName) {
        // Direct match
        if (this.cybersecurityData[countryName]) {
            return this.cybersecurityData[countryName];
        }
        
        // Handle common variations
        const variations = {
            "United States of America": "United States",
            "USA": "United States", 
            "US": "United States",
            "UK": "United Kingdom",
            "Great Britain": "United Kingdom",
            "Britain": "United Kingdom",
            "Korea, Republic of": "South Korea",
            "Republic of Korea": "South Korea",
            "Korea, Democratic People's Republic of": "North Korea",
            "Russian Federation": "Russia",
            "Iran, Islamic Republic of": "Iran",
            "Syrian Arab Republic": "Syria",
            "Venezuela, Bolivarian Republic of": "Venezuela",
            "Bolivia, Plurinational State of": "Bolivia",
            "Tanzania, United Republic of": "Tanzania"
        };
        
        // Check if there's a variation that maps to our data
        const mappedName = variations[countryName];
        if (mappedName && this.cybersecurityData[mappedName]) {
            return this.cybersecurityData[mappedName];
        }
        
        return null;
    }
    
    // Get the color for a country based on compliance status
    getCountryColor(countryName) {
        const data = this.getCybersecurityData(countryName);
        if (data && data.complianceStatus) {
            const category = this.complianceCategories[data.complianceStatus];
            return category ? category.color : this.complianceCategories.unknown.color;
        }
        return this.complianceCategories.unknown?.color || "#e0e0e0";
    }
    
    onCountryHover(event, d) {
        const countryName = this.getCountryName(d);
        const data = this.getCybersecurityData(countryName);
        
        // Bring hovered country to front by moving it to the end of the DOM
        const hoveredElement = d3.select(event.currentTarget);
        hoveredElement.raise();
        
        // Highlight country
        hoveredElement.classed("highlighted", true);
        
        // Show hover tooltip
        let labelContent = `<strong>${countryName}</strong>`;
        
        if (data) {
            const category = this.complianceCategories[data.complianceStatus];
            const statusColor = category ? category.color : '#666';
            labelContent += `<br><span style="color: ${statusColor};">● ${category ? category.label : 'Unknown'}</span>`;
            
            if (this.config.settings.showComplianceInTooltip) {
                labelContent += `<br>Units: ${data.unitsInCountry || 0}`;
                labelContent += `<br>Score: ${data.complianceScore || 'N/A'}%`;
            }
        } else {
            labelContent += '<br><span style="color: #9E9E9E;">● No Data</span>';
        }
        
        this.countryLabel
            .classed("visible", true)
            .html(labelContent)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 60) + "px");
    }
    
    onCountryHoverOut() {
        // Remove highlight from all countries except selected
        this.g.selectAll(".country")
            .classed("highlighted", false);
        
        // Hide hover tooltip
        this.countryLabel.classed("visible", false);
    }
    
    onCountryClick(event, d) {
        // Stop event from bubbling to the SVG background
        event.stopPropagation();
        
        const countryName = this.getCountryName(d);
        
        // Remove previous selection from countries
        this.g.selectAll(".country").classed("selected", false);
        
        // Select current country
        d3.select(event.currentTarget).classed("selected", true);
        
        this.selectedCountry = d;
        this.showCountryInfo(countryName);
        
        // Zoom to country if enabled
        if (this.config.settings.autoZoomOnClick) {
            this.zoomToCountry(d);
        }
    }
    

    
    showCountryInfo(countryName) {
        const data = this.getCybersecurityData(countryName);
        
        // Update info panel with cybersecurity data
        document.getElementById("country-name").textContent = countryName;
        
        if (data) {
            const category = this.complianceCategories[data.complianceStatus];
            document.getElementById("country-capital").textContent = data.cybersecurityStandard || "Not specified";
            document.getElementById("country-population").textContent = category ? category.label : "Unknown";
            document.getElementById("country-area").textContent = `${data.unitsInCountry || 0} units`;
            document.getElementById("country-currency").textContent = `${data.complianceScore || 0}%`;
            document.getElementById("country-languages").textContent = data.certifications ? data.certifications.join(", ") : "None";
            document.getElementById("country-region").textContent = data.lastAuditDate || "Never";
        } else {
            document.getElementById("country-capital").textContent = "No data available";
            document.getElementById("country-population").textContent = "Unknown";
            document.getElementById("country-area").textContent = "0 units";
            document.getElementById("country-currency").textContent = "0%";
            document.getElementById("country-languages").textContent = "None";
            document.getElementById("country-region").textContent = "Never";
        }
        
        // Show info panel
        document.getElementById("info-panel").classList.remove("hidden");
    }
    
    zoomToCountry(d) {
        const bounds = this.path.bounds(d);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.min(8, 0.9 / Math.max(dx / this.svg.attr("width"), dy / this.svg.attr("height")));
        const translate = [this.svg.attr("width") / 2 - scale * x, this.svg.attr("height") / 2 - scale * y];
        
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
    
    deselectCountry() {
        // Clear selection from countries
        this.g.selectAll(".country").classed("selected", false);
        this.selectedCountry = null;
        
        // Hide info panel
        document.getElementById("info-panel").classList.add("hidden");
    }
    
    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
        
        this.deselectCountry();
    }
    
    setupEventListeners() {
        // Close info panel
        document.getElementById("close-info").addEventListener("click", () => {
            document.getElementById("info-panel").classList.add("hidden");
            this.g.selectAll(".country").classed("selected", false);
            this.selectedCountry = null;
        });
        
        // Reset zoom button
        document.getElementById("reset-zoom").addEventListener("click", () => {
            this.resetZoom();
        });
        
        // Window resize
        window.addEventListener("resize", () => {
            this.handleResize();
        });
    }
    
    setupSearch() {
        if (!this.config.settings.enableSearch) {
            document.querySelector(".search-container").style.display = "none";
            return;
        }
        
        const searchInput = document.getElementById("country-search");
        const searchResults = document.getElementById("search-results");
        
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                searchResults.classList.add("hidden");
                return;
            }
            
            const matches = this.countries.features.filter(country => {
                const name = this.getCountryName(country).toLowerCase();
                return name.includes(query);
            }).slice(0, 10); // Limit to 10 results
            
            this.displaySearchResults(matches);
        });
        
        // Hide search results when clicking outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".search-container")) {
                searchResults.classList.add("hidden");
            }
        });
    }
    
    displaySearchResults(matches) {
        const searchResults = document.getElementById("search-results");
        
        if (matches.length === 0) {
            searchResults.classList.add("hidden");
            return;
        }
        
        searchResults.innerHTML = matches.map(country => {
            const name = this.getCountryName(country);
            const data = this.getCybersecurityData(name);
            let indicator = '';
            
            if (data) {
                const category = this.complianceCategories[data.complianceStatus];
                const color = category ? category.color : '#9E9E9E';
                indicator = ` <span style="color: ${color};">●</span>`;
            } else {
                indicator = ' <span style="color: #9E9E9E;">●</span>';
            }
            
            return `<div class="search-result-item" data-country="${name}">${name}${indicator}</div>`;
        }).join("");
        
        searchResults.classList.remove("hidden");
        
        // Add click listeners to search results
        searchResults.querySelectorAll(".search-result-item").forEach(item => {
            item.addEventListener("click", () => {
                const countryName = item.dataset.country;
                const country = matches.find(c => 
                    this.getCountryName(c) === countryName
                );
                
                if (country) {
                    this.selectCountryByData(country);
                    document.getElementById("country-search").value = countryName;
                    searchResults.classList.add("hidden");
                }
            });
        });
    }
    
    selectCountryByData(countryData) {
        const countryName = this.getCountryName(countryData);
        
        // Clear previous selection
        this.g.selectAll(".country").classed("selected", false);
        
        // Find and select the country path
        const countryPath = this.g.selectAll(".country")
            .filter(d => d === countryData);
        
        countryPath.classed("selected", true);
        
        this.selectedCountry = countryData;
        this.showCountryInfo(countryName);
        
        if (this.config.settings.autoZoomOnClick) {
            this.zoomToCountry(countryData);
        }
    }
    
    handleResize() {
        const container = d3.select("#world-map");
        const containerNode = container.node();
        const width = containerNode.clientWidth;
        const height = containerNode.clientHeight;
        
        this.svg
            .attr("width", width)
            .attr("height", height);
        
        this.svg.select("rect")
            .attr("width", width)
            .attr("height", height);
        
        this.projection
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);
        
        this.g.selectAll(".country")
            .attr("d", this.path);
        
        // Update country label positions
        this.g.selectAll(".country-label-text")
            .attr("x", d => {
                const centroid = this.path.centroid(d);
                return centroid[0];
            })
            .attr("y", d => {
                const centroid = this.path.centroid(d);
                return centroid[1];
            });
    }
    
    // Method to reload configuration (useful for dynamic updates)
    async reloadConfig() {
        await this.loadConfig();
        
        // Update country styling based on new configuration
        this.g.selectAll(".country")
            .attr("class", d => {
                const countryName = this.getCountryName(d);
                const data = this.getCybersecurityData(countryName);
                let classes = "country";
                if (data) {
                    classes += ` compliance-${data.complianceStatus}`;
                } else {
                    classes += " compliance-unknown";
                }
                if (d === this.selectedCountry) {
                    classes += " selected";
                }
                return classes;
            })
            .style("fill", d => {
                const countryName = this.getCountryName(d);
                return this.getCountryColor(countryName);
            });
    }
}

// Initialize the world map when the page loads
document.addEventListener("DOMContentLoaded", () => {
    new WorldMap();
});