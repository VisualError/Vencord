/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { findComponentByCodeLazy } from "@webpack";
const cl = classNameFactory("vc-discordtabs-");

const ThreeDots = findComponentByCodeLazy(".dots,", "dotRadius:");
export default function TypingIndicator({ isTyping }: { isTyping: boolean; }) {
    return isTyping ? (
        <div className={cl("typing-container")}>
            <ThreeDots
                dotRadius={3}
                themed={true}
                className={cl("typing-indicator")}
            />
        </div>
    ) : null;
}
