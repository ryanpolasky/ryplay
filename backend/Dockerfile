# Use a lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install Python dependencies (caching layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright's Chromium + its OS deps
RUN playwright install --with-deps chromium

# Copy the rest of the app
COPY . .

# Expose the port (internal docker network)
EXPOSE 8788

# Run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8788"]