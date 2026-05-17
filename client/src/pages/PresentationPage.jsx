import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PresentationPage() {
    const navigate = useNavigate();

    return (
        <div
            style={{
                background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
                minHeight: '100vh',
                color: '#FFFFFF',
                padding: '4rem 2rem',
                fontFamily: 'Arial, sans-serif',
            }}
        >
            <div
                style={{
                    maxWidth: '1000px',
                    margin: '0 auto',
                }}
            >
                {/* Hero Section */}
                <section style={{ marginBottom: '5rem' }}>
                    <h1
                        style={{
                            color: '#FCA616',
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            fontWeight: '800',
                            letterSpacing: '2px',
                        }}
                    >
                        LOCK IN!
                    </h1>

                    <h2
                        style={{
                            fontSize: '1.8rem',
                            marginBottom: '2rem',
                            color: '#EAEAEA',
                            fontWeight: '400',
                        }}
                    >
                        Esport Tournament Management Made Simple
                    </h2>

                    <p
                        style={{
                            fontSize: '1.15rem',
                            lineHeight: '1.9',
                            color: '#D1D1D1',
                            maxWidth: '850px',
                        }}
                    >
                        LOCK IN! is an ergonomic and modern esport tournament
                        management platform designed for every type of competition.
                        Whether you are organizing a casual fighting game session
                        with friends or managing large-scale team-based competitive
                        events, LOCK IN! helps you stay focused on the competition.
                    </p>

                    <p
                        style={{
                            fontSize: '1.15rem',
                            lineHeight: '1.9',
                            color: '#D1D1D1',
                            maxWidth: '850px',
                            marginTop: '1.5rem',
                        }}
                    >
                        Create and customize your profile, build or join a team,
                        register for tournaments, or organize your own events with
                        support for multiple tournament formats.
                    </p>
                </section>

                {/* Features Section */}
                <section style={{ marginBottom: '5rem' }}>
                    <h2
                        style={{
                            color: '#FCA616',
                            fontSize: '2rem',
                            marginBottom: '2rem',
                        }}
                    >
                        Features
                    </h2>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1.5rem',
                        }}
                    >
                        {[
                            {
                                title: 'Player & Team Management',
                                text: 'Create your own team or join existing rosters with ease.',
                            },
                            {
                                title: 'Tournament Creation',
                                text: 'Launch tournaments adapted to both Players vs Players and Team vs Team formats.',
                            },
                            {
                                title: 'Competitive Formats',
                                text: 'Manage Single Elimination, Double Elimination, and Round Robin brackets.',
                            },
                            {
                                title: 'Modern Experience',
                                text: 'Enjoy a clean and intuitive interface built for competitive gaming communities.',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                style={{
                                    background: '#202040',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(252, 166, 22, 0.2)',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                }}
                            >
                                <h3
                                    style={{
                                        color: '#FCA616',
                                        marginBottom: '1rem',
                                        fontSize: '1.2rem',
                                    }}
                                >
                                    {feature.title}
                                </h3>

                                <p
                                    style={{
                                        color: '#D1D1D1',
                                        lineHeight: '1.6',
                                    }}
                                >
                                    {feature.text}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Developer Section */}
                <section>
                    <h2
                        style={{
                            color: '#FCA616',
                            fontSize: '2rem',
                            marginBottom: '2rem',
                        }}
                    >
                        About the Developer
                    </h2>

                    <div
                        style={{
                            background: '#202040',
                            padding: '2rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(252, 166, 22, 0.2)',
                            lineHeight: '1.9',
                            color: '#D1D1D1',
                        }}
                    >
                        <p>
                            Noha Robert--Altese is a French developer living in Lyon and studying at{' '}
                            <a
                                href="https://www.epita.fr/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#FCA616', textDecoration: 'none' }}
                            >
                                EPITA
                            </a>
                            ,
                            an engineering school specialized in Computer Science.
                        </p>

                        <p style={{ marginTop: '1.5rem' }}>
                            Passionate about video games and esports,
                            he started developing LOCK IN! as an academic project
                            during his Erasmus semester at{' '}
                            <a
                                href="https://unicornuniversity.net/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#FCA616', textDecoration: 'none' }}
                            >
                                Unicorn University
                            </a>
                            {' '}in Prague.
                        </p>

                        <p style={{ marginTop: '1.5rem' }}>
                            Through this app, Noha is dedicated to provide players,
                            organizers and communities with a reliable and
                            accessible platform dedicated to esport tournament
                            management.
                        </p>
                    </div>
                </section>

                {/* Socials Section */}
                <section style={{ marginTop: '5rem' }}>
                    <h2
                        style={{
                            color: '#FCA616',
                            fontSize: '2rem',
                            marginBottom: '2rem',
                        }}
                    >
                        Find Me Online
                    </h2>

                    <div
                        style={{
                            background: '#202040',
                            padding: '2rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(252, 166, 22, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem',
                        }}
                    >
                        <p
                            style={{
                                color: '#D1D1D1',
                                lineHeight: '1.7',
                                margin: 0,
                            }}
                        >
                            Contact me via my email of feel free to follow me through my personal social media!
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '1rem',
                            }}
                        >
                            {[
                                {
                                    name: 'Email',
                                    link: 'mailto:noha.robertaltese@gmail.com',
                                },
                                {
                                    name: 'YouTube',
                                    link: 'https://www.youtube.com/@Dracau_verwatch',
                                },
                                {
                                    name: 'Twitter',
                                    link: 'https://x.com/Dracau_verwatch',
                                },
                                {
                                    name: 'Instagram',
                                    link: 'https://www.instagram.com/dracau_noha',
                                },
                                {
                                    name: 'Discord server (Tenegood)',
                                    link: 'https://discord.com/invite/JJsexG3xTM',
                                },
                            ].map((social, index) => (
                                <a
                                    key={index}
                                    href={social.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: '0.8rem 1.4rem',
                                        background: '#FCA616',
                                        color: '#1a1a2e',
                                        textDecoration: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        transition: '0.2s ease',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.opacity = '0.9';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.opacity = '1';
                                    }}
                                >
                                    {social.name}
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}