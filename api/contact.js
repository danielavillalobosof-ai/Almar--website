
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    try {
        // 1. Save to Supabase
        const { error: sbError } = await supabase
            .from('contact_submissions')
            .insert([{ name, email, message }]);
        if (sbError) throw new Error(`Supabase: ${sbError.message}`);

        // 2. Sync to HubSpot
        try {
            await axios.post('https://api.hubapi.com/crm/v3/objects/contacts', 
            { properties: { email, firstname: name } },
            { headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } });
        } catch (e) { console.log("HubSpot skip/error"); }

        // 3. Add to Mailchimp
        try {
            const mcUrl = `https://${process.env.MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`;
            await axios.post(mcUrl, 
            { email_address: email, status: 'subscribed', merge_fields: { FNAME: name } },
            { auth: { username: 'anystring', password: process.env.MAILCHIMP_API_KEY } });
        } catch (e) { console.log("Mailchimp skip/error"); }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(3000, () => console.log('Server live on port 3000'));
