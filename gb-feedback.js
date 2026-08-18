// 이미지·영상 섹션 피드백 폼 — 파일(≤5MB)은 base64로 시트 스크립트에 전달
(function () {
  document.querySelectorAll('form.fb-form').forEach(function (form) {
    var btn = form.querySelector('button[type="submit"]');
    var status = form.querySelector('.gb-status');
    var lang = form.getAttribute('data-lang') || 'ko';
    var T = lang === 'en'
      ? { sending: 'Sending…', ok: 'Sent. Thank you.', fail: 'Failed — please retry.', big: 'File exceeds 5MB.', wait: 'Opening soon' }
      : { sending: '전송 중…', ok: '전달됐습니다. 감사합니다.', fail: '전송 실패 — 다시 시도해주세요.', big: '파일이 5MB를 넘습니다.', wait: '전송 준비 중' };
    if (!window.GB_API) {
      btn.classList.add('disabled');
      status.textContent = T.wait;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!window.GB_API) return;
      var fileInput = form.querySelector('input[type="file"]');
      var file = fileInput && fileInput.files[0];
      if (file && file.size > 5 * 1024 * 1024) { status.textContent = T.big; return; }
      btn.classList.add('disabled');
      status.textContent = T.sending;
      function send(fileData, fileName, fileType) {
        var body = new URLSearchParams();
        body.append('name', form.name.value.trim());
        body.append('email', form.email.value.trim());
        body.append('insta', form.insta.value.trim());
        body.append('credit', form.credit.value);
        body.append('msg', form.msg.value.trim());
        body.append('node', form.getAttribute('data-node'));
        body.append('category', form.category.value);
        body.append('link', form.link.value.trim());
        body.append('visible', form.visible.value);
        body.append('crew', form.crew && form.crew.checked ? '지원' : '');
        body.append('news', form.news && form.news.checked ? '수신' : '');
        if (fileData) {
          body.append('fileData', fileData);
          body.append('fileName', fileName);
          body.append('fileType', fileType);
        }
        fetch(GB_API, { method: 'POST', mode: 'no-cors', body: body })
          .then(function () {
            status.classList.add('ok');
            status.textContent = T.ok;
            form.reset();
            btn.classList.remove('disabled');
          })
          .catch(function () {
            status.textContent = T.fail;
            btn.classList.remove('disabled');
          });
      }
      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          send(String(reader.result).split(',')[1], file.name, file.type);
        };
        reader.readAsDataURL(file);
      } else send();
    });
  });
})();
