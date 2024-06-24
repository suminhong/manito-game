document.addEventListener('DOMContentLoaded', async () => {
    const setupSection = document.getElementById('setup');
    const qrSection = document.getElementById('qrcodes');
    const surveySection = document.getElementById('survey');
    const qrContainer = document.getElementById('qrContainer');
    const surveyLink = document.getElementById('surveyLink');
    const participantContainer = document.getElementById('participantContainer');
    const addParticipantButton = document.getElementById('addParticipant');
    const resultsTable = document.getElementById('resultsTable') ? document.getElementById('resultsTable').getElementsByTagName('tbody')[0] : null;
    const predictionTable = document.getElementById('predictionTable') ? document.getElementById('predictionTable').getElementsByTagName('tbody')[0] : null;
    const submissionStatusContainer = document.getElementById('submissionStatusContainer');
    const showResultsButton = document.getElementById('showResultsButton');

    // 서버 URL을 환경변수에서 가져오기
    const response = await fetch('/config');
    const config = await response.json();
    const serverUrls = config.serverUrls;

    // 현재 호스트에 맞는 서버 URL 선택
    const currentHost = window.location.host;
    const serverUrl = serverUrls.find(url => url.includes(currentHost));
    console.log(`Using server URL: ${serverUrl}`);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'submit') {
            const statusDiv = document.createElement('div');
            statusDiv.textContent = `${message.name} 제출 완료 ✅`;
            statusDiv.style.color = 'green';
            submissionStatusContainer.appendChild(statusDiv);
        } else if (message.type === 'start') {
            setupSection.style.display = 'none';
            qrSection.style.display = 'block';
        } else if (message.type === 'completed') {
            showResultsButton.style.display = 'block';
        }
    };

    if (addParticipantButton) {
        addParticipantButton.addEventListener('click', () => {
            const participantDiv = document.createElement('div');
            participantDiv.className = 'participantInput';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'participantName';
            input.placeholder = 'Enter participant name';
            participantDiv.appendChild(input);
            participantContainer.appendChild(participantDiv);
        });
    }

    if (setupSection) {
        window.setupGame = () => {
            const participantNames = Array.from(document.getElementsByClassName('participantName'))
                .map(input => input.value)
                .filter(name => name.trim() !== '');

            fetch(`${serverUrl}/startGame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ participants: participantNames })
            }).then(response => {
                if (response.ok) {
                    console.log('Started new game with participants:', participantNames);

                    // 참가자 목록을 URL로 인코딩
                    const encodedParticipants = encodeURIComponent(JSON.stringify(participantNames));
                    const qrCodeData = `${window.location.origin}/survey.html?participants=${encodedParticipants}`;
                    const qr = new QRCodeStyling({
                        data: qrCodeData,
                        width: 200,
                        height: 200
                    });
                    qrContainer.innerHTML = '';
                    qr.append(qrContainer);

                    // 설문조사 링크 표시
                    surveyLink.href = qrCodeData;
                    surveyLink.textContent = qrCodeData;
                }
            });
        };
    }

    if (surveySection) {
        const urlParams = new URLSearchParams(window.location.search);
        const participants = JSON.parse(decodeURIComponent(urlParams.get('participants')));

        console.log('Loaded participant names from URL:', participants);
        const nameSelect = document.getElementById('name');
        const maniteeSelect = document.getElementById('manitee');
        const predictedManitoSelect = document.getElementById('predictedManito');
        const overallPredictionDiv = document.getElementById('overallPrediction');

        participants.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameSelect.appendChild(option);
        });

        participants.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            maniteeSelect.appendChild(option);
        });

        participants.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            predictedManitoSelect.appendChild(option);
        });

        participants.forEach(name => {
            const div = document.createElement('div');
            div.className = 'prediction-input';
            const label = document.createElement('label');
            label.textContent = `${name} : `;
            const select = document.createElement('select');
            select.name = name;
            participants.forEach(optionName => {
                const option = document.createElement('option');
                option.value = optionName;
                option.textContent = optionName;
                select.appendChild(option);
            });
            div.appendChild(label);
            div.appendChild(select);
            overallPredictionDiv.appendChild(div);
        });

        const surveyForm = document.getElementById('surveyForm');
        if (surveyForm) {
            surveyForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const name = document.getElementById('name').value;
                const manitee = document.getElementById('manitee').value;
                const predictedManito = document.getElementById('predictedManito').value;
                const satisfaction = document.querySelector('input[name="satisfaction"]:checked').value;
                const overallPrediction = {};
                participants.forEach(participant => {
                    overallPrediction[participant] = document.querySelector(`select[name="${participant}"]`).value;
                });

                fetch(`${serverUrl}/submitSurvey`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, manitee, predictedManito, satisfaction, overallPrediction })
                }).then(response => response.json())
                  .then(data => {
                    if (data.status === 'duplicate') {  // 중복 제출
                        alert('You have already submitted the survey.');
                    } else {
                        const statusDiv = document.createElement('div');
                        statusDiv.textContent = `${name} 제출 완료 ✅`;
                        statusDiv.style.color = 'green';
                        submissionStatusContainer.appendChild(statusDiv);

                        if (data.status === 'completed') {  // 모든 설문이 완료된 경우
                            ws.send(JSON.stringify({ type: 'completed' }));
                            showResultsButton.style.display = 'block';
                        }
                    }
                  });
            });
        }
    }

    if (resultsTable) {
        fetch(`${serverUrl}/getSurveyResults`)
            .then(response => response.json())
            .then(results => {
                console.log('Loaded survey results from server:', results);
                const trueManito = results.reduce((acc, result) => {
                    acc[result.manitee] = result.name;
                    return acc;
                }, {});

                // 결과 테이블에 데이터 추가
                results.forEach(result => {
                    const row = resultsTable.insertRow();
                    const maniteeCell = row.insertCell(0);
                    const manitoCell = row.insertCell(1);
                    const predictionSuccessCell = row.insertCell(2);
                    const satisfactionCell = row.insertCell(3);
                    const resultCell = row.insertCell(4);

                    maniteeCell.textContent = result.manitee;
                    manitoCell.textContent = trueManito[result.manitee];
                    predictionSuccessCell.textContent = result.predictedManito === trueManito[result.name] ? '예측 성공' : '예측 실패';
                    satisfactionCell.textContent = result.satisfaction === 'yes' ? '만족' : '불만족';

                    if (result.satisfaction === 'no') {
                        resultCell.textContent = `${trueManito[result.manitee]}이(가) ${result.manitee}에게 밥 사기 🍚`;
                    } else {
                        if (result.predictedManito === trueManito[result.manitee]) {
                            resultCell.textContent = `${trueManito[result.manitee]}이(가) ${result.manitee}에게 커피 사기 ☕️`;
                        } else {
                            resultCell.textContent = `${result.manitee}이(가) ${trueManito[result.manitee]}에게 커피 사기 ☕️`;
                        }
                    }
                });

                // 예측 결과 계산 및 테이블에 데이터 추가
                const predictionResults = results.map(result => {
                    let correctCount = 0;
                    Object.keys(result.overallPrediction).forEach(key => {
                        if (result.overallPrediction[key] === trueManito[key]) {
                            correctCount++;
                        }
                    });
                    return {
                        name: result.name,
                        correctCount
                    };
                });

                // 정렬
                predictionResults.sort((a, b) => b.correctCount - a.correctCount);

                // 순위 매기기
                let rank = 1;
                predictionResults.forEach((result, index) => {
                    if (index > 0 && result.correctCount < predictionResults[index - 1].correctCount) {
                        rank = index + 1;
                    }
                    const row = predictionTable.insertRow();
                    const rankCell = row.insertCell(0);
                    const nameCell = row.insertCell(1);
                    const correctCountCell = row.insertCell(2);

                    rankCell.textContent = rank;
                    nameCell.textContent = result.name;
                    correctCountCell.textContent = result.correctCount;
                });
            });
    }
});
