let form = document.getElementById("the-form");

form.addEventListener("submit", async event => {
  event.preventDefault();
  let formData = new FormData(form);

  // 1. Figure out what targets need to be revalidated
  let revalidationPayload = [window.__TARGETS__.get("header")];

  let res = await fetch("/update-name", {
    method: "POST",
    body: formData,
    headers: {
      // 2. Send the revalidation payload to the server so it can render them
      "X-Revalidate": JSON.stringify(revalidationPayload),
    },
  });

  let { content, targets } = await res.json();
  targets = new Map(JSON.parse(targets));

  // 3. Update target map for future revalidation (new ones could have been rendered)
  window.__TARGETS__ = new Map([...window.__TARGETS__, ...targets]);

  // 4. replace content
  revalidationPayload.forEach(([, { name }], index) => {
    let targetElement = document.querySelector(`x-target[name="${name}"]`);
    targetElement.outerHTML = content[index];
  });
});
