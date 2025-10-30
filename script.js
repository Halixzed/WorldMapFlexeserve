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
        
        // Camera follow cursor variables
        this.mousePos = { x: 0, y: 0 };
        this.cameraOffset = { x: 0, y: 0 };
        this.followIntensity = 0.02; // How much the camera follows (0-1)
        this.smoothness = 0.1; // How smooth the follow is (0-1)
        this.animationId = null;
        this.baseTransform = d3.zoomIdentity;
        
        // Setup zoom with panning constraints
        this.zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                this.baseTransform = this.constrainTransform(event.transform);
                this.applyCameraTransform();
                // Re-render country paths for crisp edges
                if (this.g && this.path) {
                    this.g.selectAll(".country")
                        .attr("d", this.path);
                }
            });
        
        this.svg.call(this.zoom);
        
        // Setup camera follow system
        this.setupCameraFollow();
        
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
    
    async loadGoogleSheetData() {
        // Replace with your Google Sheets CSV export URL
        let baseCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR-MkxJwnlndd4CNaMnbB-UrxBWUlgqZ4DwLB-ccfG2RkvQnyyAfXyz1ULg-2kB8-fx1E-mMkpbQCTQ/pub?gid=0&single=true&output=csv';
        // Add cache-busting parameter
        const csvUrl = `${baseCsvUrl}&cb=${Date.now()}`;
        const data = await d3.csv(csvUrl);
        this.cybersecurityData = {};
        data.forEach(row => {
            this.cybersecurityData[row.Country] = {
                cybersecurityStandard: row.cybersecurityStandard,
                complianceStatus: row.complianceStatus,
                unitsInCountry: row.unitsInCountry,
                complianceScore: row.complianceScore,
                certifications: row.certifications ? row.certifications.split(';') : [],
                lastAuditDate: row.lastAuditDate
            };
        });
    }
    
    async loadSharePointCsvData() {
        // Replace with your SharePoint CSV file direct link
        let baseCsvUrl = 'https://nuttallscouk.sharepoint.com/:x:/s/FlexeserveConnect/EadFIEL-xdlBm0J80SXggqsB-b0WSAz6lKJSjDLmPeiV4g?e=KdAyNN';
        // Add cache-busting parameter (handles ? or &)
        const csvUrl = baseCsvUrl + (baseCsvUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now();
        const data = await d3.csv(csvUrl);
        this.cybersecurityData = {};
        data.forEach(row => {
            this.cybersecurityData[row.Country] = {
                cybersecurityStandard: row.cybersecurityStandard,
                complianceStatus: row.complianceStatus,
                unitsInCountry: row.unitsInCountry,
                complianceScore: row.complianceScore,
                certifications: row.certifications ? row.certifications.split(';') : [],
                lastAuditDate: row.lastAuditDate
            };
        });
    }
    
    async loadData() {
        try {
            // Show loading overlay
            let loadingOverlay = document.getElementById('loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loading-overlay';
                loadingOverlay.style.position = 'fixed';
                loadingOverlay.style.top = '0';
                loadingOverlay.style.left = '0';
                loadingOverlay.style.width = '100vw';
                loadingOverlay.style.height = '100vh';
                loadingOverlay.style.background = 'rgba(51,51,51,0.95)';
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.alignItems = 'center';
                loadingOverlay.style.justifyContent = 'center';
                loadingOverlay.style.zIndex = '9999';
                loadingOverlay.innerHTML = '<div style="color:#fff;font-size:2rem;text-align:center;"><span class="loader" style="display:inline-block;width:48px;height:48px;border:6px solid #fff;border-top:6px solid #888;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;"></span><br>Loading map data...</div>';
                document.body.appendChild(loadingOverlay);
                // Add keyframes for spinner
                const style = document.createElement('style');
                style.innerHTML = '@keyframes spin {0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
                document.head.appendChild(style);
            } else {
                loadingOverlay.style.display = 'flex';
            }
            // Load world map data
            const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
            this.countries = topojson.feature(world, world.objects.countries);
            
            // Debug: Log all country names to help with configuration
            console.log("Available country names:");
            this.countries.features.forEach(d => {
                const name = this.getCountryName(d);
                console.log(`"${name}"`);
            });
            
            // Load country information from Google Sheets
            await this.loadGoogleSheetData();
            // Load country information from SharePoint CSV
            //await this.loadSharePointCsvData();
            this.drawCountries();
            // Fade out loading overlay
            loadingOverlay.style.transition = 'opacity 0.7s';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 700);
        } catch (error) {
            console.error("Error loading map data:", error);
            let loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.innerHTML = '<div style="color:#fff;font-size:2rem;text-align:center;">Error loading map data.<br>Please refresh the page.</div>';
            }
        }
    }
    
    drawCountries() {
        // Filter out Antarctica
        const filteredCountries = this.countries.features.filter(d => {
            const countryName = this.getCountryName(d);
            return countryName !== "Antarctica";
        });
        this.g.selectAll(".country")
            .data(filteredCountries)
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
        
        // Export button
        const exportBtn = document.getElementById('export-map');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMapAsPNG());
        }
        
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
    
    // Camera follow cursor system
    setupCameraFollow() {
        // Track mouse movement over the entire map container
        this.svg.on("mousemove", (event) => {
            const rect = this.svg.node().getBoundingClientRect();
            this.mousePos.x = event.clientX - rect.left;
            this.mousePos.y = event.clientY - rect.top;
        });
        
        // Start the camera follow animation loop
        this.startCameraFollow();
    }
    
    startCameraFollow() {
        const animate = () => {
            this.updateCameraPosition();
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    updateCameraPosition() {
        const rect = this.svg.node().getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate offset from center (normalized to -1 to 1)
        const normalizedX = (this.mousePos.x - centerX) / centerX;
        const normalizedY = (this.mousePos.y - centerY) / centerY;
        
        // Disable camera follow completely at base zoom level
        let effectiveIntensity = this.followIntensity;
        if (this.baseTransform.k <= 1.05) {
            // No camera follow when all regions are visible
            effectiveIntensity = 0;
        }
        
        // Calculate target camera offset - INVERTED so camera moves towards cursor
        const targetOffsetX = -normalizedX * effectiveIntensity * rect.width;
        const targetOffsetY = -normalizedY * effectiveIntensity * rect.height;
        
        // Smooth interpolation towards target
        this.cameraOffset.x += (targetOffsetX - this.cameraOffset.x) * this.smoothness;
        this.cameraOffset.y += (targetOffsetY - this.cameraOffset.y) * this.smoothness;
        
        // Apply the combined transform
        this.applyCameraTransform();
    }
    
    applyCameraTransform() {
        // Combine base zoom/pan transform with camera offset
        let combinedTransform = this.baseTransform.translate(
            this.cameraOffset.x / this.baseTransform.k,
            this.cameraOffset.y / this.baseTransform.k
        );
        
        // Apply additional constraints to the combined transform
        combinedTransform = this.constrainTransform(combinedTransform);
        
        // Apply transform smoothly
        this.g.attr("transform", combinedTransform);
    }
    
    constrainTransform(transform) {
        const rect = this.svg.node().getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Calculate the map bounds at current scale
        const mapWidth = width * transform.k;
        const mapHeight = height * transform.k;
        
        let x = transform.x;
        let y = transform.y;
        
        // At base zoom level (scale = 1), NO panning allowed - keep perfectly centered
        if (transform.k <= 1.05) {
            // Force the map to stay at the original center position
            x = 0;
            y = 0;
        } else {
            // When zoomed in, allow panning but keep some content visible
            const minX = -(mapWidth - width * 0.2); // Keep 20% of viewport visible
            const maxX = width * 0.2;
            const minY = -(mapHeight - height * 0.2);
            const maxY = height * 0.2;
            
            x = Math.max(minX, Math.min(maxX, x));
            y = Math.max(minY, Math.min(maxY, y));
        }
        
        return d3.zoomIdentity.translate(x, y).scale(transform.k);
    }
    
    // Method to adjust camera follow settings dynamically
    setCameraFollowSettings(intensity = 0.02, smoothness = 0.1) {
        this.followIntensity = Math.max(0, Math.min(1, intensity));
        this.smoothness = Math.max(0.01, Math.min(1, smoothness));
    }
    
    // Method to temporarily disable camera follow
    disableCameraFollow() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    // Method to re-enable camera follow
    enableCameraFollow() {
        if (!this.animationId) {
            this.startCameraFollow();
        }
    }

    // Export map as PNG
    async exportMapAsPNG() {
        const mapContainer = document.getElementById('world-map');
        if (!mapContainer) return;
        // Hide overlays/tooltips for clean export
        const overlays = document.querySelectorAll('.tooltip, .country-label');
        overlays.forEach(el => el.style.display = 'none');
        // Use html2canvas to capture
        html2canvas(mapContainer, {backgroundColor: null}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'world-map.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            // Restore overlays/tooltips
            overlays.forEach(el => el.style.display = '');
        });
    }
}

// Initialize the world map when the page loads
document.addEventListener("DOMContentLoaded", () => {
    new WorldMap();
});