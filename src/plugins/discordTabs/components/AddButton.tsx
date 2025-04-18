/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { findComponentByCodeLazy } from "@webpack";



const PlusSmallIcon = findComponentByCodeLazy("0v-5h5a1");
const cl = classNameFactory("vc-discordtabs-");

interface AddButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isVisible: boolean,
}

export default function AddButton({ isVisible, ...rest }: AddButtonProps) {
    console.log("Rendering AddButton");
    return (
        isVisible && <button
            {...rest}
            className={cl("button", "new-button", "hoverable", "")}
        >
            < PlusSmallIcon />
        </button>
    );
}
