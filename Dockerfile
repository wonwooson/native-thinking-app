# 1. Base image with Node 20
FROM node:20-slim

# 2. Install Python 3 and pip (required for youtube_transcript_api)
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

# Create a virtual environment for Python packages (best practice for Debian-based systems)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install the Python transcript package globally within the venv
RUN pip3 install youtube_transcript_api

# 3. Set the working directory for Node.js
WORKDIR /app

# 4. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of the application code
COPY . .

# 6. Build the Vite frontend React app
# This creates the /dist folder that the Express server will host
RUN npm run build

# 7. Expose the port (Render automatically uses PORT 10000 or reads the process.env.PORT)
EXPOSE 3001

# 8. Start the Express server in production mode
CMD ["npm", "run", "start:prod"]
