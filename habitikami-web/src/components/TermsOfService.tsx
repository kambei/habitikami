import React from 'react';

export const TermsOfService: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-primary/30">
            <div className="max-w-3xl mx-auto space-y-8 bg-card/50 p-6 md:p-10 rounded-2xl border border-border shadow-xl backdrop-blur-sm">
                
                <header className="border-b border-border pb-6">
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Terms of Service
                    </h1>
                    <p className="text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">1. Acceptance of Terms</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        By accessing or using the Habitikami web application, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">2. Description of Service</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Habitikami is a minimal habit-tracking application that utilizes your personal Google Sheets to store and retrieve your habit data. The application acts as a front-end interface to your own spreadsheet.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">3. User Accounts & Google Integration</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        To use Habitikami, you must authenticate using your Google Account and grant the application permission to access Google Sheets on your behalf. You are responsible for maintaining the security of your Google Account. Habitikami is not responsible for any unauthorized access that occurs through your Google Account.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">4. Data Ownership & Storage</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Your habit data is stored directly in your Google Sheet. You retain full ownership and control over your data. Habitikami only stores your email address and specific Google Sheet ID to maintain your session and link to your data.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">5. "As Is" Limitation of Liability</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        The service is provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, either express or implied. Habitikami and its developers shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to, damages for loss of profits, goodwill, use, data, or other intangible losses resulting from the use or the inability to use the service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">6. Modifications to the Service</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We reserve the right to modify or discontinue, temporarily or permanently, the service (or any part thereof) with or without notice at any time.
                    </p>
                </section>
                
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-foreground/90">7. Changes to Terms</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We reserve the right to update or change our Terms of Service at any time. Your continued use of the Application after we post any modifications to the Terms of Service will constitute your acknowledgment of the modifications and your consent to abide and be bound by the modified Terms of Service.
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
