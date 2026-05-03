import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PresentationPage() {
    const navigate = useNavigate();

    return (
        <div style={{
            padding: '2rem',
            color: '#FFFFFF',
            background: '#1a1a2e',
            minHeight: '100vh'
        }}>
            <h1 style={{ color: '#FCA616', marginBottom: '2rem' }}>Welcome to LOCK IN!</h1>
            <p>This is the presentation page of our Esport tournaments manager application.</p>
            <p>Use the sidebar to navigate through the site.</p>
        </div>
    );
}