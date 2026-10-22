package com.sociallink.domain;

import java.util.UUID;

public final class PublishAdapters {
    private PublishAdapters() {
    }

    public static PublishPolicy.Result dispatch(String platform, UUID targetId, boolean sandbox) {
        if (sandbox) {
            return new PublishPolicy.Result(
                    PublishPolicy.Outcome.SUCCESS,
                    "sandbox:" + targetId,
                    "sandbox",
                    "Sandbox adapter. No external API was called.",
                    true
            );
        }
        return new PublishPolicy.Result(
                PublishPolicy.Outcome.PERMANENT,
                null,
                "integration_not_verified",
                platform + " publishing is not enabled. Official API access has not passed an authorized end-to-end test.",
                false
        );
    }
}
