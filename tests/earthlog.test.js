import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Earthlog E2E Tests", () => {
  it("should load the Earthlog homepage and display the edition headline", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({ url: "https://earthlog-abdi.vercel.app" });

    const assertResult = await testdriver.assert("the headline \"Yesterday's world, explained in 3D.\" is visible");
    expect(assertResult).toBeTruthy();
  });

  it("should navigate to Today's edition and display the story player", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({ url: "https://earthlog-abdi.vercel.app" });

    await testdriver.find("\"Today's edition\" button in the navigation bar").click();

    await testdriver.find("Play the edition button", { timeout: 30000 });

    const assertResult = await testdriver.assert("the \"Play the edition\" button is visible");
    expect(assertResult).toBeTruthy();
  });
});
