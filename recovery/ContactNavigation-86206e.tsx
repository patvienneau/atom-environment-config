import { ColumnLayout, TextButton } from '@embroker/ui-toolkit/v2';
import React from 'react';

export function ContactNavigation() {
    return (
        <ColumnLayout responsive={500} center gap="20">
            {/* Do not `div` remove until EM-27177 is fixed */}
            <div />
            <TextButton
                iconPosition="left"
                color="primary-500"
                href="tel:844.436.2765"
                icon="phone"
            >
                Call 844.436.2765
            </TextButton>
            <TextButton
                iconPosition="left"
                color="primary-500"
                icon="schedule-meeting"
                href="#book-a-meeting"
            >
                Schedule a meeting
            </TextButton>
            <TextButton iconPosition="left" icon="live-chat" color="primary-500" href="#chat-now">
                Live Chat
            </TextButton>
            {/* Do not `div` remove until EM-27177 is fixed */}
            <div />
        </ColumnLayout>
    );
}
