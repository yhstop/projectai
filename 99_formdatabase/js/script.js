const scriptURL =
  "https://script.google.com/macros/s/AKfycbzahjMDeZ5ZWWUFWP0-lb1BLmqyhwjGmtPQFwBt6rU69gcy9oDrY54gEBFkrttV1efz/exec";

const form = document.forms["submit-to-google-sheet"];
const msg = document.getElementById("msg");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  fetch(scriptURL, {
    method: "POST",
    body: new FormData(form),
  })
    .then((response) => {
      msg.innerHTML = "Message sent successfully";

      setTimeout(() => {
        msg.innerHTML = "";
      }, 5000);

      form.reset();
    })
    .catch((error) => {
      console.error("Error!", error.message);
      msg.innerHTML = "전송 중 오류가 발생했습니다.";
    });
});";

const form = document.forms["submit-to-google-sheet"];
const msg = document.getElementById("msg");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  fetch(scriptURL, {
    method: "POST",
    body: new FormData(form),
  })
    .then((response) => {
      msg.innerHTML = "Message sent successfully";

      setTimeout(() => {
        msg.innerHTML = "";
      }, 5000);

      form.reset();
    })
    .catch((error) => {
      console.error("Error!", error.message);
      msg.innerHTML = "전송 중 오류가 발생했습니다.";
    });
});