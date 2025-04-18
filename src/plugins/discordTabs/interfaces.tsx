/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Icon } from "@webpack/types";

export type BasicChannelTabsProps = {
    guildId: string;
    channelId: string;
};

// TODO: Add in other tab types. Maybe add bookmarks back in.
export interface BaseTab extends BasicChannelTabsProps {
    title?: string;
    notifications?: number,
    id: string;
    icon?: Icon;
}

export type LinkedNode<T> = {
    id: string;
    data: T;
    prev?: string;
    next?: string;
};

export interface PersistedTabs<T> {
    [userId: string]: {
        tabs: Record<string, LinkedNode<T>>;
        head?: string,
        tail?: string,
    };
}
