import { Config } from '@remotion/cli/config';

/**
 * H.264 in an MP4, which is the one combination that plays everywhere a
 * committee might open it — a WhatsApp forward, an iPhone, a Windows laptop
 * in a society office, an embed on the landing page.
 */
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);
