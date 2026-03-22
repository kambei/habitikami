import React from 'react';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-primary/30">
            <div className="max-w-3xl mx-auto space-y-8 bg-card/50 p-6 md:p-10 rounded-2xl border border-border shadow-xl backdrop-blur-sm">
                
                <header className="border-b border-border pb-6">
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Privacy Policy
                    </h1>
                    <p className="text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">Introduction</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Welcome to Habitikami. This Privacy Policy explains how we collect, use, and protect your information when you use our web application. By using Habitikami, you agree to the collection and use of information in accordance with this policy. Our primary goal is to provide a minimal, secure habit-tracking experience using your own Google Sheets.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">Information We Collect</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Habitikami is designed to be as minimal and privacy-focused as possible. When you log in using your Google Account, we securely collect and store only the following information:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                        <li><strong>Your Email Address:</strong> Used strictly to identify your session and associate it with your data.</li>
                        <li><strong>Your Google Sheet ID:</strong> Once you link a Google Sheet, we save its ID to know where to read and write your habit data.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">How We Use Your Google Data</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Habitikami uses Google Workspace APIs (Google Sheets) exclusively to provide the app's functionality. We request permission to view and manage the specific spreadsheet you authorize. 
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        We <strong>do not</strong> access other spreadsheets on your Google Drive. Your habit data is read from and written directly to your own Google Sheet. We do not store your habit data on our secondary servers.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        Habitikami's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">Data Sharing & Selling</h2>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                        We do not sell, rent, or share your personal information or your Google Sheets data with any third parties. Your data remains yours.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">Security & Revoking Access</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We implement appropriate security measures to protect the basic session data (email and sheet ID) we store. Since your actual habit data remains in your Google Account, its security relies on Google's infrastructure.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        You can revoke Habitikami's access to your Google Account at any time by visiting your Google Account settings (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Security</a> section) and removing its permissions.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">Contact</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        If you have any questions about this Privacy Policy, please contact the developer via GitHub or email if provided in the app documentation.
                    </p>
                </section>
                
                <div className="pt-8 text-center">
                    <a href="/" className="inline-block px-6 py-2.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition-colors">
                        Return to App
                    </a>
                </div>

            </div>
        </div>
    );
};
