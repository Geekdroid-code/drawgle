import { challengesHtml, leaderboardHtml, todayHtml } from "./screen-html/project2-screens";
import { PhonePreview } from "./PhonePreview";
import type { PlaygroundTokens } from "./tokens";

export function TokenCanvas({ tokens }: { tokens: PlaygroundTokens }) {
  return (
    <div className="min-w-0 overflow-x-auto pb-8">
      <div className="flex min-w-max items-start gap-8 px-5 py-2 lg:px-8 xl:gap-10">
        <PhonePreview label="Today" html={todayHtml} tokens={tokens} active />
        <PhonePreview label="Challenges" html={challengesHtml} tokens={tokens} />
        <PhonePreview label="Leaderboard" html={leaderboardHtml} tokens={tokens} />
      </div>
    </div>
  );
}
