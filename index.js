require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: process.env.MONGODB_DBNAME
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

// Define a Mongoose schema and model for storing website URLs
const websiteSchema = new mongoose.Schema({
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Website = mongoose.model('Website', websiteSchema);

// Function to fetch the contents of the provided URL
const fetchWebsiteContent = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.3 Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/43.4.0',
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching website content:', error);
    throw error;
  }
};

// Function to summarize content using OpenAI
const summarizeContent = async (content) => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Summarize the following content: ${content}`,
      max_tokens: 100,
    });
    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error summarizing content:', error);
    throw error;
  }
};

// Route to accept a website URL, fetch its content, and summarize it
app.post('/api/submit-url', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const newWebsite = new Website({ url });
    await newWebsite.save();
    const content = await fetchWebsiteContent(url);
    const summary = await summarizeContent(content);
    res.status(201).json({ message: 'URL stored and content summarized successfully', data: newWebsite, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store URL, fetch content, or summarize content' });
  }
});

// Route to return the summarized content to the client
app.get('/api/get-summary/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const website = await Website.findById(id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const content = await fetchWebsiteContent(website.url);
    const summary = await summarizeContent(content);
    res.status(200).json({ message: 'Content summarized successfully', summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch or summarize content' });
  }
});

// Basic Route
app.get('/', (req, res) => {
  res.send('Welcome to the Website Summarizer API');
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});