/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import createEcid from "../../../../../src/lib/dataElements/ecid/createEcid";
import turbineVariable from "../../../helpers/turbineVariable";

describe("ECID", () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jasmine.createSpy()
    };
    turbineVariable.mock({
      logger: mockLogger
    });
  });

  afterEach(() => {
    turbineVariable.reset();
  });

  it("returns ECID", () => {
    const instanceManager = {
      getAccessor: jasmine.createSpy().and.returnValue({
        getEcid() {
          return "ABC123";
        }
      })
    };
    const dataElement = createEcid(instanceManager);

    const value = dataElement({
      instanceName: "myinstance"
    });

    expect(instanceManager.getAccessor).toHaveBeenCalledWith("myinstance");
    expect(value).toBe("ABC123");
  });

  it("logs an error when no matching instance found", () => {
    const instanceManager = {
      getAccessor: () => undefined
    };
    const dataElement = createEcid(instanceManager);

    dataElement({
      instanceName: "myinstance"
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to retrieve ECID for instance "myinstance". No matching instance was configured with this name.'
    );
  });
});
