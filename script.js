document.addEventListener('DOMContentLoaded', () => {
    const generateDataBtn = document.getElementById('generateDataBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    const rawDataDisplay = document.getElementById('rawDataDisplay');
    const insightsDisplay = document.getElementById('insightsDisplay');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    const closeMessageBox = document.getElementById('closeMessageBox');

    let popularRoutesChart = null;
    let priceTrendsChart = null;

    // !!! IMPORTANT SECURITY WARNING !!!
    // Placing your API key directly in client-side JavaScript makes it publicly visible.
    // This is a severe security risk. Anyone can copy and misuse your key.
    // This is ONLY for a very temporary, throwaway demonstration where you will
    // immediately revoke the key after use. For any real application, use a secure backend.
    const GEMINI_API_KEY = "AIzaSyCTuEbrCmCyBIi0q2_mnXAyELL1WRlIOGA"; // <--- REPLACE THIS WITH YOUR ACTUAL GEMINI API KEY

    // Function to display messages (errors, success, etc.)
    function showMessage(message, type = 'error') {
        messageText.textContent = message;
        messageBox.classList.remove('hidden');
        if (type === 'error') {
            messageBox.classList.remove('bg-green-100', 'border-green-400', 'text-green-700');
            messageBox.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
        } else { // For success or info
            messageBox.classList.remove('bg-red-100', 'border-red-400', 'text-red-700');
            messageBox.classList.add('bg-green-100', 'border-green-400', 'text-green-700');
        }
    }

    // Function to hide the message box
    function hideMessageBox() {
        messageBox.classList.add('hidden');
    }

    // Event listener for closing the message box
    closeMessageBox.addEventListener('click', hideMessageBox);

    // --- Helper Function for Data Simulation (moved from Python) ---
    function generateSimulatedData(numBookings = 100) {
        const cities = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"];
        const data = [];
        const today = new Date();

        for (let i = 0; i < numBookings; i++) {
            const origin = cities[Math.floor(Math.random() * cities.length)];
            let destination = cities[Math.floor(Math.random() * cities.length)];
            while (destination === origin) { // Ensure origin and destination are different
                destination = cities[Math.floor(Math.random() * cities.length)];
            }
            
            // Simulate dates within the next 30-90 days
            const bookingDate = new Date(today);
            bookingDate.setDate(today.getDate() + Math.floor(Math.random() * 61) + 30); // 30 to 90 days from now
            
            // Simulate price variations
            const basePrice = Math.random() * (600 - 150) + 150;
            const price = parseFloat((basePrice * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2)); // +/- 10% noise
            
            // Simulate demand score (higher score means higher demand)
            const demandScore = Math.floor(Math.random() * 10) + 1;

            data.push({
                id: i + 1,
                origin: origin,
                destination: destination,
                date: bookingDate.toISOString().split('T')[0], // YYYY-MM-DD format
                price: price,
                demand_score: demand_score
            });
        }
        return data;
    }

    generateDataBtn.addEventListener('click', async () => {
        // Hide previous results and show loading indicator
        resultsContainer.classList.add('hidden');
        hideMessageBox();
        loadingIndicator.classList.remove('hidden');
        generateDataBtn.disabled = true; // Disable button during loading

        try {
            // Step 1: Generate simulated data directly in the browser
            const simulatedData = generateSimulatedData();
            rawDataDisplay.textContent = JSON.stringify(simulatedData, null, 2);

            // Step 2: Prepare prompt for Gemini API
            const dataString = JSON.stringify(simulatedData, null, 2);
            const prompt = `
            Analyze the following simulated airline booking data and provide actionable insights.
            Focus on identifying:
            1.  **Popular Routes:** Which origin-destination pairs appear frequently or have high demand scores?
            2.  **Price Trends:** Are prices generally increasing, decreasing, or stable? Mention any outliers.
            3.  **High-Demand Periods/Locations:** Are there specific dates, months, or cities that show higher demand?

            Present your insights clearly and concisely.

            Simulated Booking Data:
            ${dataString}
            `;

            // Step 3: Call Gemini API directly from client-side JavaScript
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "text/plain"
                }
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Attempt to parse error message from response body
                let errorDetails = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    if (errorJson && errorJson.error && errorJson.error.message) {
                        errorDetails += ` - ${errorJson.error.message}`;
                    }
                } catch (e) {
                    // Ignore if response is not JSON
                }
                throw new Error(errorDetails);
            }
            
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                
                const insightsText = result.candidates[0].content.parts[0].text;
                insightsDisplay.textContent = insightsText;
            } else {
                throw new Error("Failed to get insights from AI model due to unexpected response structure.");
            }

            // Step 4: Process data for charts
            renderCharts(simulatedData);

            // Show results
            resultsContainer.classList.remove('hidden');
            showMessage("Data generated and insights retrieved successfully!", "success");

        } catch (error) {
            console.error('Error:', error);
            showMessage(`Failed to retrieve data or insights: ${error.message}. Please check your API key and browser console for CORS issues.`);
        } finally {
            loadingIndicator.classList.add('hidden');
            generateDataBtn.disabled = false; // Re-enable button
        }
    });

    function renderCharts(data) {
        // Destroy existing charts if they exist to prevent memory leaks and re-render issues
        if (popularRoutesChart) {
            popularRoutesChart.destroy();
        }
        if (priceTrendsChart) {
            priceTrendsChart.destroy();
        }

        // --- Popular Routes Chart ---
        const routeCounts = {};
        data.forEach(booking => {
            const route = `${booking.origin} to ${booking.destination}`;
            routeCounts[route] = (routeCounts[route] || 0) + 1;
        });

        // Sort routes by popularity and take top N
        const sortedRoutes = Object.entries(routeCounts).sort(([, countA], [, countB]) => countB - countA);
        const topRoutes = sortedRoutes.slice(0, 7); // Show top 7 routes

        const popularRoutesCtx = document.getElementById('popularRoutesChart').getContext('2d');
        popularRoutesChart = new Chart(popularRoutesCtx, {
            type: 'bar',
            data: {
                labels: topRoutes.map(item => item[0]),
                datasets: [{
                    label: 'Number of Bookings',
                    data: topRoutes.map(item => item[1]),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    borderRadius: 5, // Rounded bars
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Bookings'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Route'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide legend if only one dataset
                    },
                    title: {
                        display: true,
                        text: 'Top Popular Routes'
                    }
                }
            }
        });

        // --- Price Trends Chart (Average Price by Month) ---
        const monthlyPrices = {};
        data.forEach(booking => {
            const month = booking.date.substring(0, 7); // YYYY-MM
            if (!monthlyPrices[month]) {
                monthlyPrices[month] = { sum: 0, count: 0 };
            }
            monthlyPrices[month].sum += booking.price;
            monthlyPrices[month].count++;
        });

        const sortedMonths = Object.keys(monthlyPrices).sort();
        const averagePrices = sortedMonths.map(month => 
            (monthlyPrices[month].sum / monthlyPrices[month].count).toFixed(2)
        );

        const priceTrendsCtx = document.getElementById('priceTrendsChart').getContext('2d');
        priceTrendsChart = new Chart(priceTrendsCtx, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: 'Average Price ($)',
                    data: averagePrices,
                    fill: false,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    pointBackgroundColor: 'rgb(255, 99, 132)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(255, 99, 132)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Average Price ($)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Airline Price Trends by Month'
                    }
                }
            }
        });
    }
});
